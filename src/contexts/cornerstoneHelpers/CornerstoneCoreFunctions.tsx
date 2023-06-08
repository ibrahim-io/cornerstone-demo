import dicomParser from 'dicom-parser';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/streaming-image-volume-loader';

import { ptScalingMetaDataProvider } from './MetadataProviders';

import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import dcmjs from 'dcmjs';

import { calibratedPixelSpacingMetadataProvider } from '@cornerstonejs/core/dist/esm/utilities';
import { PublicViewportInput } from '@cornerstonejs/core/dist/esm/types';
import { ViewportType } from '@cornerstonejs/core/dist/esm/enums';
import {
  addTool,
  addToolToGroup,
  getOrCreateToolGroup,
  syncVoiViewports,
} from './CornerstoneToolFunctions';
import { MouseBindings } from '@cornerstonejs/tools/dist/esm/enums';
import { CalibratedPixelValue } from '@cornerstonejs/core/dist/esm/utilities/calibratedPixelSpacingMetadataProvider';
import { imageMetadataProvider } from './imageMetadataProvider';
import { getDicomMetadata } from '../../utils/imgLoadUtils';
const { DicomMetaDictionary } = dcmjs.data;

export const removeInvalidTags = (srcMetadata: { [tagId: string]: any }) => {
  // Object.create(null) make it ~9% faster
  const dstMetadata = Object.create(null);
  const tagIds = Object.keys(srcMetadata);
  let tagValue;

  tagIds.forEach((tagId) => {
    tagValue = srcMetadata[tagId];
    if (tagValue !== undefined && tagValue !== null) dstMetadata[tagId] = tagValue;
  });

  return dstMetadata;
};

export type TImageMetadataRequest = {
  image_type: 'dicom' | 'nifti' | 'png/jpg';
  data: {
    [filepath: string]: {
      image_uri: string;
      image_metadata?: {
        [tagId: string]: any;
      };
    };
  };
};

const isErrorRequest = (
  request: TImageMetadataRequest | { error: string },
): request is { error: string } => {
  return (request as { error: string }).error !== undefined;
};

export const loadAndCacheMetadata = (imageIds: string[]) => {
  imageIds.map((imageId) => {
    
    const metadata = cornerstoneWADOImageLoader.wadors.metaDataManager.get(imageId);
    console.log(metadata);
    


    
    const cleanedMetadata = DicomMetaDictionary.naturalizeDataset(removeInvalidTags(metadata));
    imageMetadataProvider.add(imageId, metadata);

   
    const pixelSpacing = getPixelSpacingInformation(cleanedMetadata);

    if (pixelSpacing === undefined) return;
    if (
      typeof pixelSpacing === 'object' &&
      'PixelSpacing' in pixelSpacing &&
      pixelSpacing.PixelSpacing !== undefined
    ) {
      calibratedPixelSpacingMetadataProvider.add(
        imageId,
        pixelSpacing.PixelSpacing.map((s: string) => parseFloat(s)),
      );
    } else if (Array.isArray(pixelSpacing) && pixelSpacing.length === 2) {
      calibratedPixelSpacingMetadataProvider.add(imageId, {
        rowPixelSpacing: pixelSpacing[0],
        columnPixelSpacing: pixelSpacing[1],
      });
    }
  });

};

export const initializeCornerstone = async () => {
  // Initialise Metadata Provider
  cornerstone.metaData.addProvider(
    ptScalingMetaDataProvider.get.bind(ptScalingMetaDataProvider),
    10000,
  );
  cornerstone.metaData.addProvider(
    cornerstone.utilities.calibratedPixelSpacingMetadataProvider.get.bind(
      cornerstone.utilities.calibratedPixelSpacingMetadataProvider,
    ),
    11000,
  );
  cornerstone.metaData.addProvider(imageMetadataProvider.get.bind(imageMetadataProvider), 500);

  // Initialise cornerstone WADO image loader
  const { preferSizeOverAccuracy, useNorm16Texture } = cornerstone.getConfiguration().rendering;
  cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
  cornerstoneWADOImageLoader.external.dicomParser = dicomParser;
  cornerstoneWADOImageLoader.configure({
    useWebWorkers: true,
    decodeConfig: {
      convertFloatPixelDataToInt: false,
      use16BitDataType: preferSizeOverAccuracy || useNorm16Texture,
    },
  });

  let maxWebWorkers = 1;

  if (navigator.hardwareConcurrency) maxWebWorkers = Math.min(navigator.hardwareConcurrency, 7);

  const config = {
    maxWebWorkers,
    startWebWorkersOnDemand: false,
    taskConfiguration: {
      decodeTask: {
        initializeCodecsOnStartup: true,
        strict: false,
      },
    },
  };
  cornerstoneWADOImageLoader.webWorkerManager.initialize(config);

  cornerstone.setUseSharedArrayBuffer(false);
  // Initialise Volume Rendering
  cornerstone.volumeLoader.registerUnknownVolumeLoader(
    cornerstoneStreamingImageVolumeLoader as unknown as cornerstone.Types.VolumeLoaderFn,
  );
  cornerstone.volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingImageVolume',
    cornerstoneStreamingImageVolumeLoader as unknown as cornerstone.Types.VolumeLoaderFn,
  );
  cornerstone.volumeLoader.registerVolumeLoader(
    'cornerstoneStreamingDynamicImageVolume',
    cornerstoneStreamingDynamicImageVolumeLoader as unknown as cornerstone.Types.VolumeLoaderFn,
  );

  // Initialise main cornerstone and tools
  await cornerstone.init();
  await cornerstoneTools.init();
};

const uploadImages = (files: any, name: string, setImageIds: (strings: string[]) => void) => {
  const fileImageIds = files.map((filestack: any) =>
    filestack.map((file: any) => {
      const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);

      getDicomMetadata(file).then((metadata: any) => {
        cornerstoneWADOImageLoader.wadors.metaDataManager.add(imageId, metadata);
      });

      return imageId;
    }),
  );
  setImageIds(fileImageIds)
};

export default function getPixelSpacingInformation(instance: any) {
  // See http://gdcm.sourceforge.net/wiki/index.php/Imager_Pixel_Spacing

  // TODO: Add Ultrasound region spacing
  // TODO: Add manual calibration

  // TODO: Use ENUMS from dcmjs
  const projectionRadiographSOPClassUIDs = [
    '1.2.840.10008.5.1.4.1.1.1', //	CR Image Storage
    '1.2.840.10008.5.1.4.1.1.1.1', //	Digital X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.1.1', //	Digital X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.1.2', //	Digital Mammography X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.2.1', //	Digital Mammography X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.1.3', //	Digital Intra – oral X-Ray Image Storage – for Presentation
    '1.2.840.10008.5.1.4.1.1.1.3.1', //	Digital Intra – oral X-Ray Image Storage – for Processing
    '1.2.840.10008.5.1.4.1.1.12.1', //	X-Ray Angiographic Image Storage
    '1.2.840.10008.5.1.4.1.1.12.1.1', //	Enhanced XA Image Storage
    '1.2.840.10008.5.1.4.1.1.12.2', //	X-Ray Radiofluoroscopic Image Storage
    '1.2.840.10008.5.1.4.1.1.12.2.1', //	Enhanced XRF Image Storage
    '1.2.840.10008.5.1.4.1.1.12.3', // X-Ray Angiographic Bi-plane Image Storage	Retired
  ];

  const {
    PixelSpacing,
    ImagerPixelSpacing,
    SOPClassUID,
    PixelSpacingCalibrationType,
    PixelSpacingCalibrationDescription,
    EstimatedRadiographicMagnificationFactor,
    SequenceOfUltrasoundRegions,
  } = instance;

  const isProjection = projectionRadiographSOPClassUIDs.includes(SOPClassUID);

  const TYPES = {
    NOT_APPLICABLE: 'NOT_APPLICABLE',
    UNKNOWN: 'UNKNOWN',
    CALIBRATED: 'CALIBRATED',
    DETECTOR: 'DETECTOR',
  };

  if (!isProjection) {
    return PixelSpacing;
  }

  if (isProjection && !ImagerPixelSpacing) {
    // If only Pixel Spacing is present, and this is a projection radiograph,
    // PixelSpacing should be used, but the user should be informed that
    // what it means is unknown
    return {
      PixelSpacing,
      type: TYPES.UNKNOWN,
      isProjection,
    };
  } else if (PixelSpacing && ImagerPixelSpacing && PixelSpacing === ImagerPixelSpacing) {
    // If Imager Pixel Spacing and Pixel Spacing are present and they have the same values,
    // then the user should be informed that the measurements are at the detector plane
    return {
      PixelSpacing,
      type: TYPES.DETECTOR,
      isProjection,
    };
  } else if (PixelSpacing && ImagerPixelSpacing && PixelSpacing !== ImagerPixelSpacing) {
    // If Imager Pixel Spacing and Pixel Spacing are present and they have different values,
    // then the user should be informed that these are "calibrated"
    // (in some unknown manner if Pixel Spacing Calibration Type and/or
    // Pixel Spacing Calibration Description are absent)
    return {
      PixelSpacing,
      type: TYPES.CALIBRATED,
      isProjection,
      PixelSpacingCalibrationType,
      PixelSpacingCalibrationDescription,
    };
  } else if (!PixelSpacing && ImagerPixelSpacing) {
    let CorrectedImagerPixelSpacing = ImagerPixelSpacing;
    if (EstimatedRadiographicMagnificationFactor) {
      // Note that in IHE Mammo profile compliant displays, the value of Imager Pixel Spacing is required to be corrected by
      // Estimated Radiographic Magnification Factor and the user informed of that.
      // TODO: should this correction be done before all of this logic?
      CorrectedImagerPixelSpacing = ImagerPixelSpacing.map(
        (pixelSpacing: number) => pixelSpacing / EstimatedRadiographicMagnificationFactor,
      );
    } else {
      console.warn(
        'EstimatedRadiographicMagnificationFactor was not present. Unable to correct ImagerPixelSpacing.',
      );
    }

    return {
      PixelSpacing: CorrectedImagerPixelSpacing,
      isProjection,
    };
  } else if (SequenceOfUltrasoundRegions && typeof SequenceOfUltrasoundRegions === 'object') {
    const { PhysicalDeltaX, PhysicalDeltaY } = SequenceOfUltrasoundRegions;
    const USPixelSpacing = [PhysicalDeltaX * 10, PhysicalDeltaY * 10];

    return {
      PixelSpacing: USPixelSpacing,
    };
  } else if (
    SequenceOfUltrasoundRegions &&
    Array.isArray(SequenceOfUltrasoundRegions) &&
    SequenceOfUltrasoundRegions.length > 1
  ) {
    console.warn(
      'Sequence of Ultrasound Regions > one entry. This is not yet implemented, all measurements will be shown in pixels.',
    );
  }

  console.warn(
    'Unknown combination of PixelSpacing and ImagerPixelSpacing identified. Unable to determine spacing.',
  );
}

export const initialiseStackViewportForPage = async (
  renderEngine: cornerstone.RenderingEngine,
  renderEngineId: string,
  ref: HTMLDivElement,
  refId: string,
) => {
  addTool(cornerstoneTools.WindowLevelTool);
  addTool(cornerstoneTools.PanTool);
  addTool(cornerstoneTools.ZoomTool);

  const viewportInput = {
    viewportId: refId,
    type: ViewportType.STACK,
    element: ref,
  };

  renderEngine.enableElement(viewportInput);

  const toolGroupId = 'image-explorer';
  const toolGroup = getOrCreateToolGroup(toolGroupId);
  toolGroup.addViewport(refId, renderEngineId);

  addToolToGroup('image-explorer', cornerstoneTools.PanTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.ZoomTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.WindowLevelTool.toolName);

  toolGroup.setToolActive(cornerstoneTools.PanTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  });

  toolGroup.setToolActive(cornerstoneTools.ZoomTool.toolName, {
    bindings: [{ numTouchPoints: 2 }],
  });

  toolGroup.setToolActive(cornerstoneTools.PanTool.toolName, {
    bindings: [{ numTouchPoints: 3 }],
  });
};

export const initialiseTrioViewportsForPage = async (
  renderEngine: cornerstone.RenderingEngine,
  renderEngineId: string,
  refs: { [imgRefId: string]: HTMLDivElement },
  refIds: string[],
  getReferenceLineColor?: (viewportId: string) => string,
) => {
  const viewportInputArray: PublicViewportInput[] = [
    {
      viewportId: refIds[0],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[0]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: refIds[1],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[1]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: refIds[2],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[2]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.CORONAL,
      },
    },
  ];

  const toolGroupId = 'image-explorer';
  const toolGroup = getOrCreateToolGroup(toolGroupId);

  if (renderEngine.getViewports().length > 0) {
    // If the refIds are present in the viewport Ids, then the viewports have already been initialised
    const viewportIds = renderEngine.getViewports().map((viewport) => viewport.id);
    if (refIds.every((refId) => viewportIds.includes(refId))) {
      renderEngine.setViewports(viewportInputArray);
      toolGroup.addViewport(refIds[0], renderEngineId);
      toolGroup.addViewport(refIds[1], renderEngineId);
      toolGroup.addViewport(refIds[2], renderEngineId);

      const voiSync = cornerstoneTools.SynchronizerManager.getSynchronizer('ctWLSync');
      if (voiSync !== undefined) {
        cornerstoneTools.SynchronizerManager.destroySynchronizer('ctWLSync');
        syncVoiViewports(viewportInputArray, renderEngineId);
      }
      return;
    }
  }
  const isViewportId = (viewportId: string) =>
    viewportId === refIds[0] || viewportId === refIds[1] || viewportId === refIds[2];
  const getReferenceLineControllable = (viewportId: string) => isViewportId(viewportId);
  const getReferenceLineDraggableRotatable = (viewportId: string) => isViewportId(viewportId);
  const getReferenceLineSlabThicknessControlsOn = (viewportId: string) => isViewportId(viewportId);
  if (getReferenceLineColor === undefined)
    getReferenceLineColor = (viewportId: string) => {
      if (viewportId === refIds[0]) return 'yellow';
      if (viewportId === refIds[1]) return 'green';
      if (viewportId === refIds[2]) return 'red';
      return 'yellow';
    };

  addTool(cornerstoneTools.StackScrollMouseWheelTool);
  addTool(cornerstoneTools.CrosshairsTool);
  addTool(cornerstoneTools.WindowLevelTool);
  addTool(cornerstoneTools.PanTool);
  addTool(cornerstoneTools.ZoomTool);
  addTool(cornerstoneTools.StackScrollTool);

  renderEngine.setViewports(viewportInputArray);

  toolGroup.addViewport(refIds[0], renderEngineId);
  toolGroup.addViewport(refIds[1], renderEngineId);
  toolGroup.addViewport(refIds[2], renderEngineId);

  // Sync viewports for windowing only
  syncVoiViewports(viewportInputArray, renderEngineId);

  addToolToGroup('image-explorer', cornerstoneTools.StackScrollMouseWheelTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.ZoomTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.CrosshairsTool.toolName, {
    getReferenceLineColor,
    getReferenceLineControllable,
    getReferenceLineDraggableRotatable,
    getReferenceLineSlabThicknessControlsOn,
  });
  addToolToGroup('image-explorer', cornerstoneTools.PanTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.WindowLevelTool.toolName);
  addToolToGroup('image-explorer', cornerstoneTools.StackScrollTool.toolName);

  toolGroup.setToolActive(cornerstoneTools.StackScrollMouseWheelTool.toolName);
  toolGroup.setToolActive(cornerstoneTools.ZoomTool.toolName, {
    bindings: [{ numTouchPoints: 2 }],
  });
  toolGroup.setToolActive(cornerstoneTools.StackScrollTool.toolName, {
    bindings: [{ numTouchPoints: 3 }],
  });
  toolGroup.setToolActive(cornerstoneTools.CrosshairsTool.toolName, {
    bindings: [{ mouseButton: MouseBindings.Primary }],
  });
};

export const reRenderTrioViewport = async (
  renderEngine: cornerstone.RenderingEngine,
  refs: { [imgRefId: string]: HTMLDivElement },
  refIds: string[],
) => {
  const viewportInputArray: PublicViewportInput[] = [
    {
      viewportId: refIds[0],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[0]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.AXIAL,
      },
    },
    {
      viewportId: refIds[1],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[1]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.SAGITTAL,
      },
    },
    {
      viewportId: refIds[2],
      type: ViewportType.ORTHOGRAPHIC,
      element: refs[refIds[2]]!,
      defaultOptions: {
        orientation: cornerstone.Enums.OrientationAxis.CORONAL,
      },
    },
  ];

  renderEngine.setViewports(viewportInputArray);
  renderEngine.disableElement(refIds[0]);
  renderEngine.disableElement(refIds[1]);
  renderEngine.disableElement(refIds[2]);
  renderEngine.enableElement(viewportInputArray[0]);
  renderEngine.enableElement(viewportInputArray[1]);
  renderEngine.enableElement(viewportInputArray[2]);
  renderEngine.render();
};

export const fetchAndRenderVolumeDICOMData = async (
  renderEngine: cornerstone.RenderingEngine,
  imageIds: string[],
  volumeId: string,
  refIds: string[],
) => {
  loadAndCacheMetadata(imageIds);
  console.log(imageIds);
  

  const cachedVolume = cornerstone.cache.getVolume(volumeId);

  if (cachedVolume === undefined) {
    const volume = await cornerstone.volumeLoader.createAndCacheVolume(volumeId, {
      imageIds: imageIds.map((id) => 'wadors:'+id),
    });
    await volume.load();
  }
  await renderViewports(volumeId, renderEngine, refIds);
};

export const fetchAndRenderStackDICOMData = async (
  renderEngine: cornerstone.RenderingEngine,
  refId: string,
) => {
  // const metadata = await loadAndCacheMetadata(imagePath);
  // if (metadata?.image_type !== 'dicom') {
  //   console.error('Only DICOM images are supported');
  //   return;
  // }
  // const imageUris = Object.values(
  //   metadata.data as {
  //     [filepath: string]: { image_uri: string; image_metadata?: any };
  //   },
  // ).map((image) => 'wadors:/api/' + image.image_uri);
  // const viewport: IStackViewport = renderEngine.getViewport(refId) as IStackViewport;
  // await viewport.setStack(imageUris);
  // await viewport.render();
  // viewport.reset(true);
};

export const renderViewports = async (
  volumeId: string,
  renderEngine: cornerstone.RenderingEngine,
  refs: string[],
) => {
  await cornerstone.setVolumesForViewports(
    renderEngine,
    [
      {
        volumeId,
        callback: ({ volumeActor }) => {
          // VolumeActor.getProperty().getRGBTransferFunction(0).setMappingRange(-200, 200);
        },
      },
    ],
    refs,
  );
  renderEngine.renderViewports(refs);
};
