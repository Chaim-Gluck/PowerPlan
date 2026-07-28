import { Card, CardContent, Box, Typography, Avatar } from '@mui/material';
import type { ReactNode } from 'react';

interface Props {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  accent?: boolean;
}

/** Dashboard KPI card. */
export default function StatCard({ title, value, subtitle, icon, color = '#1976d2', accent }: Props) {
  return (
    <Card
      elevation={0}
      sx={{
        height: '100%',
        border: '1px solid',
        borderColor: 'divider',
        background: accent
          ? `linear-gradient(135deg, ${color}22, ${color}05)`
          : undefined,
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          {icon && (
            <Avatar sx={{ bgcolor: `${color}22`, color, width: 36, height: 36 }} variant="rounded">
              {icon}
            </Avatar>
          )}
        </Box>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          {value}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}
