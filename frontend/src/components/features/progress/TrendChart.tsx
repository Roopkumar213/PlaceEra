import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Card, CardHeader, CardTitle, CardContent } from '../../ui/card';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

interface ActivityPoint {
    date: string;
    score: number; // or mastery level
}

interface TrendChartProps {
    data: ActivityPoint[];
    loading?: boolean;
}

const TrendChart: React.FC<TrendChartProps> = ({ data, loading }) => {

    const chartData = useMemo(() => {
        // Sort by date just in case
        const sorted = [...data].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        return {
            labels: sorted.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
            datasets: [
                {
                    label: 'Readiness Trend',
                    data: sorted.map(d => d.score),
                    fill: true,
                    borderColor: 'rgb(99, 102, 241)', // Indigo-500
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    tension: 0.4, // Smooth curve
                    pointRadius: 4,
                    pointHoverRadius: 6
                }
            ]
        };
    }, [data]);

    const options = {
        responsive: true,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            }
        },
        scales: {
            y: {
                min: 0,
                max: 100,
                grid: {
                    color: 'rgba(255, 255, 255, 0.05)'
                }
            },
            x: {
                grid: {
                    display: false
                }
            }
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false
        }
    };

    if (loading) return <div className="h-64 w-full bg-muted animate-pulse rounded-lg" />;

    return (
        <Card className="col-span-1 lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Performance Trend (Last 10 Sessions)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[300px] w-full">
                    <Line options={options} data={chartData} />
                </div>
            </CardContent>
        </Card>
    );
};

export default TrendChart;
