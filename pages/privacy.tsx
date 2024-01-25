import { Box, Typography, CssVarsProvider } from '@mui/joy';
import { useRouter } from 'next/navigation';

const CustomTypography = ({ children, ...props }: { children: React.ReactNode; [key: string]: any }) => (
  <Typography color="primary" {...props}>
    {children}
  </Typography>
);

export default function Privacy() {
  const router = useRouter();
  return (
    <CssVarsProvider>
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          paddingX: '20%',
          color: '#fff',
          background: `radial-gradient(circle at 84% 82%, rgba(217, 217, 217,0.03) 0%, rgba(217, 217, 217,0.03) 21%,transparent 21%, transparent 100%),radial-gradient(circle at 75% 56%, rgba(3, 3, 3,0.03) 0%, rgba(3, 3, 3,0.03) 30%,transparent 30%, transparent 100%),radial-gradient(circle at 74% 53%, rgba(153, 153, 153,0.03) 0%, rgba(153, 153, 153,0.03) 95%,transparent 95%, transparent 100%),radial-gradient(circle at 86% 43%, rgba(209, 209, 209,0.03) 0%, rgba(209, 209, 209,0.03) 83%,transparent 83%, transparent 100%),radial-gradient(circle at 64% 88%, rgba(192, 192, 192,0.03) 0%, rgba(192, 192, 192,0.03) 2%,transparent 2%, transparent 100%),radial-gradient(circle at 73% 77%, rgba(205, 205, 205,0.03) 0%, rgba(205, 205, 205,0.03) 18%,transparent 18%, transparent 100%),radial-gradient(circle at 57% 51%, rgba(161, 161, 161,0.03) 0%, rgba(161, 161, 161,0.03) 64%,transparent 64%, transparent 100%),radial-gradient(circle at 40% 84%, rgba(115, 115, 115,0.03) 0%, rgba(115, 115, 115,0.03) 14%,transparent 14%, transparent 100%),linear-gradient(90deg, rgb(0,0,0),rgb(0,0,0))`,
        }}
      >
        <CustomTypography
          width="100%"
          component="h1"
          sx={{
            color: 'white',
            fontSize: '3rem',
            textAlign: 'center',
            '&:hover': {
              cursor: 'pointer',
            },
          }}
          onClick={() => router.push('/')}
        >
          big-AGI
        </CustomTypography>
        <CustomTypography level="h3" component="h1" mb={4} sx={{ fontWeight: 'bold' }}>
          Privacy Policy
        </CustomTypography>
        <CustomTypography level="body-lg" mb={2}>
          Effective Date: 1/24/2024
        </CustomTypography>
        <CustomTypography level="body-lg" mb={2}>
          Welcome to bigAGI. Protecting your private information is our priority. This Privacy Policy outlines our practices concerning the collection, use, and
          protection of your information.
        </CustomTypography>
        <CustomTypography level="h4" component="h2" mb={2} sx={{ fontWeight: 'bold' }}>
          1. Information Collection
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          <strong>Google OAuth API:</strong> We use the Google OAuth API for authentication. We collect and store only your email address to grant access to our
          services. No other personal information is collected.
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          <strong>Chat Histories:</strong> We store chat histories to enhance and evaluate the performance of bigAGI. This data is used solely for statistical
          analysis and is not linked to any personally identifiable information unless such information is voluntarily provided by you within the chat content.
        </CustomTypography>
        <CustomTypography level="h4" component="h2" mb={2} sx={{ fontWeight: 'bold' }}>
          2. Use of Information
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          The information we collect is used exclusively for the following purposes:
          <ul>
            <li>To facilitate access to our services by authenticating users.</li>
            <li>To analyze and improve the functionality and performance of bigAGI through statistical analysis of chat data.</li>
          </ul>
        </CustomTypography>
        <CustomTypography level="h4" component="h2" mb={2} sx={{ fontWeight: 'bold' }}>
          3. Data Security
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          We prioritize the security of your data. We implement stringent security measures to protect against unauthorized access, alteration, disclosure, or
          destruction of your personal information and chat data.
        </CustomTypography>
        <CustomTypography level="h4" component="h2" mb={2} sx={{ fontWeight: 'bold' }}>
          4. Changes to This Privacy Policy
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          We may update our Privacy Policy periodically. We will notify you of any changes by posting the new policy on this page. We encourage you to review
          this Privacy Policy periodically to stay informed about how we are protecting your information.
        </CustomTypography>
        <CustomTypography level="h4" component="h2" mb={2} sx={{ fontWeight: 'bold' }}>
          5. Contacting Us
        </CustomTypography>
        <CustomTypography level="body-md" mb={4}>
          If you have any questions or comments about this Privacy Policy, please do not hesitate to contact us.
        </CustomTypography>
        <CustomTypography level="body-md" mb={2}>
          This document was last updated on 1/24/2024.
        </CustomTypography>
      </Box>
    </CssVarsProvider>
  );
}
