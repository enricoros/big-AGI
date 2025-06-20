import * as React from 'react';
import { Box, Typography, Alert, CircularProgress, Select, Option, Button, Textarea, Input } from '@mui/joy';

import type { DLLM } from '~/common/stores/llms/llms.types';
import { useModelsStore } from '~/common/stores/llms/store-llms';
import { zhipuAIGenerateVideoStart, zhipuAICheckVideoStatus, ZhipuAIVideoTask, ZhipuAIVideoStatus } from '~/modules/llms/vendors/zhipuai/zhipuai.client';
import { PageCore } from '~/common/layout/optima/PageCore';


// Placeholder for sub-components - will create these next
// import { VideoCreationForm } from './VideoCreationForm';
// import { VideoStatusDisplay } from './VideoStatusDisplay';
// import { VideoPlayer } from './VideoPlayer';

const LLM_IF_Generates_Video = 'outputs-video'; // As defined in zhipuai.vendor.ts

export function VideoGenerator() {
  const [selectedModelId, setSelectedModelId] = React.useState<string | null>(null);
  const [prompt, setPrompt] = React.useState<string>('');
  const [imageBase64, setImageBase64] = React.useState<string | null>(null);
  const [task, setTask] = React.useState<ZhipuAIVideoTask | null>(null);
  const [videoStatus, setVideoStatus] = React.useState<ZhipuAIVideoStatus | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [isPolling, setIsPolling] = React.useState<boolean>(false);

  const { llms } = useModelsStore(state => ({ llms: state.llms }));

  const videoModels = React.useMemo(() => {
    return llms.filter(llm => llm.interfaces.includes(LLM_IF_Generates_Video as any) && llm.vId === 'zhipuai');
  }, [llms]);

  React.useEffect(() => {
    if (videoModels.length > 0 && !selectedModelId) {
      setSelectedModelId(videoModels[0].id);
    }
  }, [videoModels, selectedModelId]);

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string)?.split(',')[1];
        setImageBase64(base64String || null);
      };
      reader.readAsDataURL(file);
    } else {
      setImageBase64(null);
    }
  };

  const handleSubmit = async () => {
    if (!selectedModelId || !prompt) {
      setError('Please select a model and enter a prompt.');
      return;
    }

    const selectedLLM = videoModels.find(m => m.id === selectedModelId);
    if (!selectedLLM) {
      setError('Selected model not found.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTask(null);
    setVideoStatus(null);

    try {
      // For image_url, ZhipuAI expects a URL. If we have base64, we'd need to upload it first.
      // This is a simplification for now and assumes image_url is not directly used with base64.
      // A real implementation would need a service to host the image or use a different API field if available.
      // For now, we'll pass undefined for imageUrl if only base64 is present.
      // A better approach for image-to-video would be to get a URL for the uploaded image.
      let imageUrlForApi: string | undefined = undefined;
      if (imageBase64) {
        // In a real app, upload imageBase64 to a service and get a URL.
        // For this example, we'll simulate this by setting a placeholder,
        // but the ZhipuAI API would need a real, accessible URL.
        console.warn("Image upload is present, but sending a direct URL for image_url is required by ZhipuAI. Base64 cannot be sent directly. This will likely fail if the model requires an image_url.");
        // imageUrlForApi = "data:image/png;base64," + imageBase64; // This is NOT a URL
      }

      const currentTask = await zhipuAIGenerateVideoStart(selectedLLM, prompt, imageUrlForApi);
      setTask(currentTask);
      setIsLoading(false);
      if (currentTask.task_status === 'PROCESSING' || currentTask.task_status === 'PENDING') { // Assuming PENDING is a possible state
        setIsPolling(true);
      } else {
        // Handle immediate success or failure from start if that's possible
        setVideoStatus(currentTask as ZhipuAIVideoStatus);
      }
    } catch (e: any) {
      setError(e.message || 'Failed to start video generation.');
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    if (!task || !isPolling || task.task_status === 'SUCCESS' || task.task_status === 'FAILED') {
      if (task && (task.task_status === 'SUCCESS' || task.task_status === 'FAILED')) {
        setIsPolling(false);
        setVideoStatus(task as ZhipuAIVideoStatus); // Update final status
      }
      return;
    }

    const intervalId = setInterval(async () => {
      try {
        const statusResult = await zhipuAICheckVideoStatus(task.id);
        setVideoStatus(statusResult);
        setTask(st => ({ ...st!, task_status: statusResult.task_status })); // Update task with new status

        if (statusResult.task_status === 'SUCCESS' || statusResult.task_status === 'FAILED') {
          setIsPolling(false);
          clearInterval(intervalId);
        }
      } catch (e: any) {
        setError(`Failed to check video status: ${e.message}`);
        setIsPolling(false); // Stop polling on error
        clearInterval(intervalId);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(intervalId);
  }, [task, isPolling]);


  return (
    <PageCore title="Generate Video">
      <Box sx={{ maxWidth: 'md', margin: 'auto', mt: 2, p: 2 }}>
        <Typography level="h3" component="h1" sx={{ mb: 2 }}>
          Video Generation (with ZhipuAI CogVideoX)
        </Typography>

        {/* Model Selection */}
        <Typography level="title-md" sx={{mt: 2}}>Select Model</Typography>
        <Select
          value={selectedModelId}
          onChange={(_, newValue) => setSelectedModelId(newValue)}
          disabled={isLoading || isPolling || videoModels.length === 0}
        >
          {videoModels.length === 0 && <Option value="" disabled>No video models available</Option>}
          {videoModels.map(model => (
            <Option key={model.id} value={model.id}>
              {model.label} ({model.id.replace('zhipuai-', '')})
            </Option>
          ))}
        </Select>

        {/* Prompt Input */}
        <Typography level="title-md" sx={{mt: 2}}>Prompt</Typography>
        <Textarea
          placeholder="Enter your video prompt..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          minRows={3}
          maxRows={6}
          disabled={isLoading || isPolling}
          sx={{mt: 1}}
        />

        {/* Image Upload (Optional) */}
        <Typography level="title-md" sx={{mt: 2}}>Image (Optional for Image-to-Video)</Typography>
        <Input
          type="file"
          accept="image/png, image/jpeg"
          onChange={handleImageUpload}
          disabled={isLoading || isPolling}
          sx={{mt: 1}}
        />
        {imageBase64 && <img src={`data:image/png;base64,${imageBase64}`} alt="Uploaded preview" style={{maxWidth: '100%', maxHeight: 200, marginTop: 8}}/>}


        <Button
          onClick={handleSubmit}
          loading={isLoading}
          disabled={isLoading || isPolling || !selectedModelId || !prompt}
          sx={{ mt: 2, minWidth: 150 }}
        >
          Generate Video
        </Button>

        {error && <Alert color="danger" sx={{ mt: 2 }}>{error}</Alert>}

        {/* Status Display */}
        {task && (
          <Box sx={{mt: 3, p:2, border: '1px solid', borderColor: 'divider', borderRadius: 'md'}}>
            <Typography level="title-lg">Task Status</Typography>
            <Typography>ID: {task.id}</Typography>
            <Typography>Status: {videoStatus?.task_status || task.task_status} {isPolling && <CircularProgress size="sm" sx={{ml: 1}}/>}</Typography>
            {videoStatus?.error && <Alert color="warning" sx={{mt:1}}>Error: {videoStatus.error.message} (Code: {videoStatus.error.code})</Alert>}
          </Box>
        )}

        {/* Video Player */}
        {videoStatus && videoStatus.task_status === 'SUCCESS' && videoStatus.videos && videoStatus.videos.length > 0 && (
           <Box sx={{mt: 3}}>
            <Typography level="title-lg" sx={{mb:1}}>Generated Video(s)</Typography>
            {videoStatus.videos.map((video, index) => (
              <Box key={index} sx={{mb: 2}}>
                {video.cover_image_url && <img src={video.cover_image_url} alt={`Cover for video ${index + 1}`} style={{maxWidth: '100%', marginBottom: '8px'}} />}
                <video controls width="100%" src={video.url} poster={video.cover_image_url}>
                  Your browser does not support the video tag.
                </video>
              </Box>
            ))}
           </Box>
        )}
      </Box>
    </PageCore>
  );
}
