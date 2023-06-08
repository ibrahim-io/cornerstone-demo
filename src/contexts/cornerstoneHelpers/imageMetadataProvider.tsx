
const metadata: { [key: string]: any } = {};

function add(imageId: string, metadata: any) {
  metadata['wadors:'+imageId] = metadata;
}

function get(type: string, imageId: string) {
  if (type === 'metadata') {
    return metadata['wadors:'+imageId];
  }
}

export const imageMetadataProvider = { add, get };
