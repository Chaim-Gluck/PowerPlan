import { Card, CardContent, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}

/** Card wrapper for charts with a title/subtitle header. */
export default function ChartCard({ title, subtitle, action, children }: Props) {
  return (
    <Card elevation={0} sx={{ height: '100%', border: '1px solid', borderColor: 'divider' }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="h6">{title}</Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {action}
        </Box>
        {children}
      </CardContent>
    </Card>
  );
}
