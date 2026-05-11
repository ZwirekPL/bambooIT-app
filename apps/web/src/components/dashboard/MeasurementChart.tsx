'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

const FIELD_LABELS: Record<string, string> = {
  waistCm: 'Talia',
  hipCm: 'Biodra',
  chestCm: 'Klatka',
  thighCm: 'Udo',
  armCm: 'Ramie',
  bodyFatPct: 'Tkanka tluszcz.',
};

const FIELD_UNITS: Record<string, string> = {
  waistCm: 'cm',
  hipCm: 'cm',
  chestCm: 'cm',
  thighCm: 'cm',
  armCm: 'cm',
  bodyFatPct: '%',
};

const CHART_COLORS: Record<string, string> = {
  waistCm: '#ef4444',
  hipCm: '#f97316',
  chestCm: '#3b82f6',
  thighCm: '#8b5cf6',
  armCm: '#10b981',
  bodyFatPct: '#f59e0b',
};

interface ChartPoint {
  date: string;
  [key: string]: string | number | null | undefined;
}

interface Props {
  data: ChartPoint[];
}

export function MeasurementChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 10 }}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6 }}
          formatter={(value, name) => [
            `${value} ${FIELD_UNITS[name as string] ?? ''}`,
            FIELD_LABELS[name as string] ?? name,
          ]}
        />
        <Legend
          formatter={(value) => (
            <span style={{ fontSize: 11 }}>{FIELD_LABELS[value] ?? value}</span>
          )}
        />
        {Object.keys(CHART_COLORS)
          .filter((key) => data.some((p) => p[key] != null))
          .map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[key]}
              dot={false}
              activeDot={{ r: 4 }}
              connectNulls
              strokeWidth={1.5}
            />
          ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
