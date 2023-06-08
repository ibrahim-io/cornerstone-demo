import { Box, Stack, Image, Group, useMantineTheme, LoadingOverlay } from '@mantine/core';
import ErrorOverlay from './ErrorOverlay';
import { useRenderEngine } from '../contexts/CornerstoneRenderingContext';
import { useCallback, useEffect, useState } from 'react';
import {
  fetchAndRenderStackDICOMData,
  fetchAndRenderVolumeDICOMData,
  initialiseStackViewportForPage,
  initialiseTrioViewportsForPage,
} from '../contexts/cornerstoneHelpers/CornerstoneCoreFunctions';
import { useQuery } from 'react-query';
import { getToolGroup } from '../contexts/cornerstoneHelpers/CornerstoneToolFunctions';

const DICOMImageViewer = (props: {
  imageIds: any;
  minDim: number;
  setIsTrioLoading: (val: boolean) => void;
}) => {
  const { imageIds, minDim, setIsTrioLoading } = props;

  return (
    <DICOMImageTrioComponent
      minDim={minDim}
      imageIds={imageIds}
      setIsTrioLoading={setIsTrioLoading}
    />
  );
};

const DICOMImageTrioComponent = (props: {
  minDim: number;
  imageIds: any;
  setIsTrioLoading: (val: boolean) => void;
}) => {
  const { imageIds, minDim, setIsTrioLoading } = props;
  const theme = useMantineTheme();
  const { renderEngine, renderEngineId, setToolsList } = useRenderEngine();
  const [refs, setRefs] = useState<{ [refId: string]: HTMLDivElement }>({});

  const imageKeys = ['CT-AXIAL', 'CT-SAGITTAL', 'CT-CORONAL'];
  const volumeId = `cornerstoneStreamingImageVolume:${imageIds[0]}`;
  const onRefOneChange = useCallback((ref: HTMLDivElement | null) => {
    if (ref === null) return;
    setRefs((prev) => ({ ...prev, [imageKeys[0]]: ref }));
  }, []);
  const onRefTwoChange = useCallback((ref: HTMLDivElement | null) => {
    if (ref === null) return;
    setRefs((prev) => ({ ...prev, [imageKeys[1]]: ref }));
  }, []);
  const onRefThreeChange = useCallback((ref: HTMLDivElement | null) => {
    if (ref === null) return;
    setRefs((prev) => ({ ...prev, [imageKeys[2]]: ref }));
  }, []);

  // Initialize the page
  const { isFetched, error: initError } = useQuery<any, string>(
    ['imageExplorerRendererInit'],
    async () => {
      if (!renderEngine) return;
      if (imageKeys.map((key) => refs[key] === undefined).reduce((a, b) => a || b)) return;
      return initialiseTrioViewportsForPage(
        renderEngine!,
        renderEngineId,
        refs,
        imageKeys,
        getReferenceLineColor,
      ).then(() => {
        const toolGroup = getToolGroup('image-explorer');
        if (toolGroup !== undefined) setToolsList(Object.keys(toolGroup._toolInstances));
      });
    },
    {
      enabled:
        renderEngine !== undefined &&
        !imageKeys.map((key) => refs[key] === undefined).reduce((a, b) => a || b),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      cacheTime: undefined,
    },
  );
  // Load the dicom data
  const { isLoading, error: fetchError } = useQuery<any, string>(
    ['imageExplorerRenderer', imageIds[0]],
    async () => {
      if (!renderEngine) return;
      if (imageKeys.map((key) => refs[key] === undefined).reduce((a, b) => a || b)) return;
      return fetchAndRenderVolumeDICOMData(renderEngine!, imageIds, volumeId, imageKeys);
    },
    {
      enabled:
        renderEngine !== undefined &&
        !imageKeys.map((key) => refs[key] === undefined).reduce((a, b) => a || b) &&
        isFetched,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      cacheTime: undefined,
    },
  );

  useEffect(() => {
    setIsTrioLoading(isLoading);
  }, [isLoading]);

  const getReferenceLineColor = useCallback(
    (viewportId: string) => {
      switch (viewportId) {
        case imageKeys[0]:
          return theme.colors.status[1];
        case imageKeys[1]:
          return theme.colors.status[2];
        case imageKeys[2]:
          return theme.colors.status[0];
        default:
          return theme.colors.status[1];
      }
    },
    [imageKeys, theme.colors.status],
  );

  if (fetchError !== undefined && fetchError !== null && fetchError !== '') {
    return (
      <ErrorOverlay
        errorMsg={'These images cannot be accessed because of the following error.'}
        errorDetails={`${fetchError}`}
      />
    );
  } else
    return (
      <Group w='100%' pos='relative'>
        <Group h='100%' spacing={theme.spacing.xs} sx={{ alignItems: 'flex-start' }} pr='xs' noWrap>
          <Box
            h={minDim}
            w={minDim}
            miw={minDim}
            mih={minDim}
            key={`trio-image-${imageKeys[0]}`}
            sx={{ cursor: 'pointer' }}
            ref={onRefOneChange}
            unselectable='on'
            onContextMenu={(e) => e.preventDefault()}
            onSelectCapture={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
            bg={theme.black}
          />
          <Stack w={'100%'} h={'100%'} sx={{ gap: theme.spacing.xs }}>
            {imageKeys.map((imageKey, index) => {
              if (index === 0) return null;
              return (
                <Box
                  h={minDim / 2}
                  w={minDim / 2}
                  key={`trio-image-${imageKey}`}
                  sx={{ cursor: 'pointer' }}
                  ref={index === 1 ? onRefTwoChange : onRefThreeChange}
                  unselectable='on'
                  onContextMenu={(e) => e.preventDefault()}
                  onSelectCapture={(e) => e.preventDefault()}
                  onMouseDown={(e) => e.preventDefault()}
                  bg={theme.black}
                />
              );
            })}
          </Stack>
        </Group>
      </Group>
    );
};

export { DICOMImageViewer as DICOMImageTrio };
