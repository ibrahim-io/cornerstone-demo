import React, { createContext, useContext, useState } from 'react';
import '../App.css';
import { useSetState } from '@mantine/hooks';
import dicomParser from 'dicom-parser';
import * as cornerstone from '@cornerstonejs/core';
import cornerstoneWADOImageLoader from 'cornerstone-wado-image-loader';
import { getDicomMetadata } from '../utils/imgLoadUtils';

cornerstoneWADOImageLoader.external.cornerstone = cornerstone;
cornerstoneWADOImageLoader.external.dicomParser = dicomParser;

const ImageContext = createContext<
  | {
      dataStore: any;
      uploadImages: any;
      getImageId: any;
      originalImagesName: string;
      setOriginalImagesName: any;
      dicomsLoaded: boolean;
      setDicomsLoaded: (boolean: boolean) => void;
    }
  | undefined
>(undefined);

type TImageProviderProps = {
  children: React.ReactNode;
};

export function ImageProvider({ children }: TImageProviderProps) {
  const [dataStore, setDataStore] = useSetState<{
    ogImageIds: string[];
    products: any;
    productInfo: any;
  }>({ ogImageIds: [], products: {}, productInfo: {} });
  const [currentIdx, setIdx] = useState<number | null>(null);
  const [originalImagesName, setOriginalImagesName] = useState('');
  const [dicomsLoaded, setDicomsLoaded] = useState<boolean>(false);

  const updateCurrentIndex = (idx: number) => {
    setIdx(idx);
  };
  const getImageId = (productName = undefined) => {
    const idx = currentIdx;
    if (idx === null) return undefined;
    if (productName === undefined && dataStore.ogImageIds[idx]) return dataStore.ogImageIds[idx];
    if (productName === undefined) return dataStore.ogImageIds[idx];
    if (dataStore.products[productName] === undefined) return undefined;
    return dataStore.products[productName][idx];
  };

  const uploadImages = (files: any, name: string) => {
    const ogImageIds = files.map((filestack: any) =>
      filestack.map((file: any) => {
        const imageId = cornerstoneWADOImageLoader.wadouri.fileManager.add(file);

        getDicomMetadata(file).then((metadata) => {
          cornerstoneWADOImageLoader.wadors.metaDataManager.add(imageId, metadata);
        });

        return imageId;
      }),
    );
    setDataStore({ ...dataStore, ogImageIds });
    updateCurrentIndex(0);
  };

  return (
    <ImageContext.Provider
      value={{
        dataStore,
        uploadImages,
        getImageId,
        originalImagesName,
        setOriginalImagesName,
        dicomsLoaded,
        setDicomsLoaded,
      }}>
      {children}
    </ImageContext.Provider>
  );
}

export function useImages() {
  const ctx = useContext(ImageContext);
  if (ctx === undefined) throw new Error('useImages must be used within a ImageProvider');
  return ctx;
}
