import dicomParser from 'dicom-parser'

/**
 * This function is used to handle the selection of a folder containing DICOM files
 *  ie a stack of slices.
 *
 * Reads and stores the files in the format: [[file1, file2, file3], [file1, file2, file3]...]
 * */
export const handleFolderSelect = (
  handleFiles: any,
  setDicomsLoaded: (boolean: boolean) => void
) => {
  // This ts-ignore is needed because the showDirectoryPicker function is not yet in the TypeScript definitions
  // (Only works on Chrome, Edge and Opra for now)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  window.showDirectoryPicker().then((dirHandle) => {
    // DICOM study structure:
    // - Root Folder
    //   - [Patient ID]
    //     - [Study ID]
    //       - [Series ID]
    //         - [DICOM File Instances]
    //
    const readOgFiles = async () => {
      const files = [];
      let name = dirHandle.name;
      const paths = [];

      for await (const [patientIdName, patientIdHandle] of dirHandle.entries()) {
        let path = '';
        path += patientIdName + '/';

        // Skip files, only looking for patientId folders
        if (patientIdHandle.kind === 'file') continue;
        for await (const [studyIdName, studyIdHandle] of patientIdHandle.entries()) {
          path += studyIdName + '/';
          // Skip files, only looking for studyId folders
          if (studyIdHandle.kind === 'file') continue;
          for await (const [seriesIdName, seriesIdHandle] of studyIdHandle.entries()) {
            path += seriesIdName;
            paths.push(path);
            // Skip files, only looking for seriesId folders
            if (seriesIdHandle.kind === 'file') continue;
            // Adds all files in series to a stack
            const fileStack = [];
            for await (const [fileName, fileHandle] of seriesIdHandle.entries()) {
              // Look for dicom files
              if (fileHandle.kind === 'directory') continue;

              if (fileName.endsWith('.dcm')) {
                const file = await fileHandle.getFile();
                fileStack.push(file);
              }
            }
            if (fileStack.length > 0) {
              files.push(fileStack);
            }
          }
        }
      }
      if (files.length === 0)
        throw new Error(
          'No DICOM files found in selected folder (in the form of <patient>/<study>/<series>/<dicom files>)',
        );

      return [files, name];
    };

    readOgFiles()
      .then((res) => {
        const [files, name] = res;
        handleFiles(files, name);
        setDicomsLoaded(true)
      })
      .catch((err) => {
        alert(err);
      });
  });
};


/**
 * This function is used to handle the selection of a folder containing DICOM files via the drag and drop method
 *
 * Reads files outputted as [file1, file2, file3, file1, file2, file3...] as File objects and organises them into stacks
 * depending on the parient id, storing the files in the format: [[file1, file2, file3], [file1, file2, file3]...]
 *
 * @param {FileList} fileList - The list of files selected by the user
 * @param {function} handleFiles - A function that handles files and updates the page state
 * @param {string[]} existingNames - A list of names that have already been used
 * @param {function} updateFileName - A function to update the name of the file in the UI
 *
 * */
export const handleDragFolderSelect = (
  fileList: any,
  handleFiles: any,
  setDicomsLoaded: (boolean:boolean) => void
) => {
  const files = [];
  let name = fileList[0].path.split('/')[1];

  // Check there are files to upload
  if (fileList.length === 0) {
    throw new Error('No files selected');
  }

  // Organise files into stacks
  let fileStack = [];
  let lastPatientId = '';
  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const patientId = file.path.split('/')[2];

    // Check that the file is a DICOM and is organised in the correct format
    if (file.path.split('/').length < 6 || file.path.split('/')[5].split('.')[1] !== 'dcm') {
      throw new Error(
        'No DICOM files found in selected folder (in the form of <patient>/<study>/<series>/<dicom files>)',
      );
    }

    if (lastPatientId !== patientId) {
      if (fileStack.length > 0) {
        files.push(fileStack);
      }
      fileStack = [];
      lastPatientId = patientId;
    }

    fileStack.push(file);
  }
  if (fileStack.length > 0) {
    files.push(fileStack);
  }

  handleFiles(files, name);
  setDicomsLoaded(true)
};

export const getDicomMetadata: (
  file: File,
) => Promise<{ [key: string]: { Value: any[]; vr: string } }> = async (file: File) => {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    let metadata: { [key: string]: { Value: any[]; vr: string } } = {};
    reader.onload = function (file) {
      const arrayBuffer = reader.result;
      // Here we have the file data as an ArrayBuffer.  dicomParser requires as input a
      // Uint8Array so we create that here
      const byteArray = new Uint8Array(arrayBuffer as ArrayBuffer);
      metadata = parseByteArray(byteArray);
      res(metadata);
    };
    reader.readAsArrayBuffer(file);
  });
};

const parseByteArray: (byteArray: Uint8Array) => { [key: string]: { Value: any[]; vr: string } } = (
  byteArray: Uint8Array,
) => {
  // We need to setup a try/catch block because parseDicom will throw an exception
  // if you attempt to parse a non dicom part 10 file (or one that is corrupted)
  let metadata: { [key: string]: { Value: any[]; vr: string } } = {};
  try {
    // parse byteArray into a DataSet object using the parseDicom library
    const dataSet = dicomParser.parseDicom(byteArray);

    const options = {
      omitPrivateAttibutes: false,
      maxElementLength: 128,
    };
    const obj = dicomParser.explicitDataSetToJS(dataSet, options);

    const imageMetadata: { [key: string]: { Value: any[]; vr: string } } = {};
    const keys = Object.keys(dataSet.elements);

    keys.forEach((key) => {
      const value = (obj as unknown as { [key: string]: any })[key];
      if (value !== undefined) {
        const vr = dataSet.elements[key].vr;
        if (vr !== undefined) {
          if (vr === 'US' || vr === 'DS' || vr === 'IS') {
            imageMetadata[key.slice(1).toUpperCase()] = {
              Value: value.split('\\').map((v: any) => parseInt(v) || 0),
              vr: vr,
            };
          } else if (vr === 'CS') {
            imageMetadata[key.slice(1).toUpperCase()] = {
              Value: value.split('\\'),
              vr: vr,
            };
          } else if (vr !== 'OB') {
            imageMetadata[key.slice(1).toUpperCase()] = {
              Value: [value],
              vr: vr,
            };
          }
        }
      }
    });

    metadata = imageMetadata;
  } catch (err) {
    // we catch the error and display it to the user
    console.log('parseError: ' + err);
  }
  return metadata;
};
