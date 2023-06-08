import { useState } from "react"
import { useImages } from "../contexts/ImageContext"
import { Group, Space, Stack, Text } from "@mantine/core"
import { handleDragFolderSelect, handleFolderSelect } from "../utils/imgLoadUtils"
import { useDropzone } from "react-dropzone"
import { DICOMImageTrio } from "../components/ImageTrio"
import { useElementSize } from "@mantine/hooks"

const Upload = () => {
  const { uploadImages, getImageId } = useImages()
  const [dicomsLoaded, setDicomsLoaded] = useState<boolean>(false)
  return (
    <UploadInstructions
      imageIds={getImageId()}
      dicomsLoaded={dicomsLoaded}
      onClick={() => {
        handleFolderSelect(
          uploadImages,
          setDicomsLoaded
        );
      }}
      onDragNDrop={(acceptedFiles: any) => {
        handleDragFolderSelect(acceptedFiles, uploadImages, setDicomsLoaded);
      }}
      message={'upload images'}
    />
  )
}

type TUploadInstructionsProps = {
  onClick: any;
  onDragNDrop: any;
  message: any;
  dicomsLoaded: boolean;
  imageIds: string[];
};

const UploadInstructions = ({ onClick, onDragNDrop, message, dicomsLoaded, imageIds }: TUploadInstructionsProps) => {
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: any) => {
      onDragNDrop(acceptedFiles);
    },
  });
  const { ref, height, width } = useElementSize();
  const minDim = Math.min((height - 20) * 0.85, (width * 0.95) / 1.5);
  console.log(imageIds);
  

  return (
    <Stack
      w='100%'
      h='100%'
      maw='840px'
      sx={{
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
        border: `3px dashed white`,
        cursor: 'pointer',
        borderRadius: '10px',
        '&:hover': {
          backgroundColor: 'gray',
        },
      }}
      {...getRootProps({
        onClick: (event) => {
          event.stopPropagation();
          onClick(event);
        },
      })}>
      {!dicomsLoaded || imageIds.length === 0 ? (
        <Stack align='center' justify='center'>
          {message}
          <Text size='1.3em' sx={{ fontFamily: 'Montserrat' }}>
            The folder should be structured as follows:
          </Text>
          <Stack
            p='sm'
            sx={{
              backgroundColor: 'gray',
              alignItems: 'flex-start',
              lineHeight: '1.3rem',
              borderRadius: '10px',
            }}>
            <Text size='1.2em' sx={{ fontFamily: 'Montserrat' }}>
              - Root Folder
            </Text>
            <Group>
              <Space h='sm' />
              <Text size='1.2em' sx={{ fontFamily: 'Montserrat' }}>
                - [Study ID]
              </Text>
            </Group>
            <Group>
              <Space h='sm' />
              <Space h='sm' />
              <Text size='1.2em' sx={{ fontFamily: 'Montserrat' }}>
                - [Series ID]
              </Text>
            </Group>
            <Group>
              <Space h='sm' />
              <Space h='sm' />
              <Space h='sm' />
              <Text size='1.2em' sx={{ fontFamily: 'Montserrat' }}>
                - [DICOM File Instances, eg. image_stack_001.dcm]
              </Text>
            </Group>
          </Stack>
        </Stack>
      ) : (
        <Stack ref={ref}>
          <DICOMImageTrio minDim={minDim} imageIds={imageIds} setIsTrioLoading={() => false} />
        </Stack>
      )}
    </Stack>
  );
};

export default Upload