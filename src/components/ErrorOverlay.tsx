import { Notification, Stack, Text, useMantineTheme } from '@mantine/core';
import { FaTimes } from 'react-icons/fa';

export const ErrorOverlay = (props: { errorMsg: string; errorDetails: string }) => {
  const { errorMsg, errorDetails } = props;
  const theme = useMantineTheme();

  return (
    <Stack
      w='100%'
      h='100%'
      sx={{ justifyContent: 'center', alignContent: 'center', flexWrap: 'wrap' }}>
      <Notification
        title={<Text size={theme.fontSizes.md}>Error</Text>}
        icon={<FaTimes />}
        radius='md'
        color='red'
        sx={{ padding: theme.spacing.md }}>
        <Text size={theme.fontSizes.md}>{errorMsg}</Text>
        <Text size={theme.fontSizes.md}>{errorDetails}</Text>
      </Notification>
    </Stack>
  );
};

export default ErrorOverlay;
