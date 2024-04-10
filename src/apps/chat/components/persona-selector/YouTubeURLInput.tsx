import * as React from 'react';
import { Button, Input } from '@mui/joy';
import YouTubeIcon from '@mui/icons-material/YouTube';

interface YouTubeURLInputProps {
  onSubmit: (url: string) => void;
  isFetching: boolean;
}

export const YouTubeURLInput: React.FC<YouTubeURLInputProps> = ({ onSubmit, isFetching }) => {
  const [url, setUrl] = React.useState('');

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUrl(event.target.value);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); // Prevent form from causing a page reload
    if (onSubmit && url) {
      onSubmit(url);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '16px' }}>
      <Input
        required
        type='url'
        fullWidth
        disabled={isFetching}
        variant='outlined'
        placeholder='Enter YouTube Video URL'
        value={url}
        onChange={handleChange}
        startDecorator={<YouTubeIcon sx={{ color: '#f00' }} />}
        sx={{ mb: 1.5, backgroundColor: 'background.popup' }}
      />
      <Button
        type='submit'
        variant='solid'
        disabled={isFetching || !url}
        loading={isFetching}
        sx={{ minWidth: 140 }}
      >
        Get Transcript
      </Button>
    </form>
  );
};