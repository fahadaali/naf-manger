import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface ChartCardProps {
  title: string;
  type: 'doughnut' | 'bar';
  data: any;
  options?: any;
}

export default function ChartCard({ title, type, data, options }: ChartCardProps) {
  const defaultOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  const chartOptions = { ...defaultOptions, ...options };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-slate-200">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">{title}</h3>
      <div className="h-64">
        {type === 'doughnut' ? (
          <Doughnut data={data} options={chartOptions} />
        ) : (
          <Bar data={data} options={chartOptions} />
        )}
      </div>
    </div>
  );
}