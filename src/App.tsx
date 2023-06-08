import './App.css'
import Upload from './containers/Upload'
import { RenderEngineProvider } from './contexts/CornerstoneRenderingContext'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ImageProvider } from './contexts/ImageContext'

//this is a demo intended to work with the dicom_data folder in the assets dir
const App = () => {
  const queryClient = new QueryClient()
  return (
    <RenderEngineProvider>
      <QueryClientProvider client={queryClient}>
        <ImageProvider>
          <Upload />
        </ImageProvider>
      </QueryClientProvider>
    </RenderEngineProvider>
  )
}




export default App
