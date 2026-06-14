"use client";

import { useEffect, useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { getPortfolioHistory } from "@/lib/api";
import { PortfolioHistory } from "@/lib/types";
import { usePortfolio } from "@/components/providers/PortfolioProvider";

type Filter = "1M" | "3M" | "6M" | "1Y" | "All";
const FILTERS: Filter[] = ["1M", "3M", "6M", "1Y", "All"];

const MONTHS_MAP: Record<Filter, number | null> = {
  "1M": 1,
  "3M": 3,
  "6M": 6,
  "1Y": 12,
  All: null,
};

export function PortfolioChart() {
  const { formatCurrency } = usePortfolio();
  const [data, setData] = useState<PortfolioHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<Filter>("1Y");

  useEffect(() => {
    getPortfolioHistory().then((history) => {
      setData(history);
      setLoading(false);
    });
  }, []);

  const filteredData = useMemo(() => {
    const months = MONTHS_MAP[timeFilter];
    if (months === null) return data;
    return data.slice(-months);
  }, [data, timeFilter]);

  const startValue = filteredData[0]?.value ?? 0;
  const endValue = filteredData[filteredData.length - 1]?.value ?? 0;
  const totalChange = endValue - startValue;
  const changePct = startValue > 0 ? (totalChange / startValue) * 100 : 0;
  const isPositive = totalChange >= 0;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-2xl p-6 flex flex-col h-[400px]">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-white">Portfolio Performance</h3>
          {!loading && (
            <p
              className={`text-sm font-medium mt-0.5 ${
                isPositive ? "text-[var(--positive)]" : "text-[var(--negative)]"
              }`}
            >
              {isPositive ? "+" : ""}
              {formatCurrency(totalChange)} ({isPositive ? "+" : ""}
              {changePct.toFixed(2)}%) this period
            </p>
          )}
        </div>
        <div className="flex bg-[var(--surface)] rounded-lg p-1 border border-[var(--border)]">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setTimeFilter(f)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                timeFilter === f
                  ? "bg-[var(--card)] text-white shadow-sm border border-[var(--border)]"
                  : "text-[var(--text-secondary)] hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 w-full relative mt-4">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full border-2 border-[var(--border)] border-t-[var(--accent)] animate-spin" />
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={filteredData}
              margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--accent)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--accent)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                dy={10}
              />
              <YAxis
                stroke="var(--text-muted)"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                width={60}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "white",
                }}
                itemStyle={{ color: "var(--accent)" }}
                formatter={(value) => [
                  `$${Number(value).toLocaleString()}`,
                  "Value",
                ]}
                labelStyle={{
                  color: "var(--text-secondary)",
                  marginBottom: "4px",
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="var(--accent)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorValue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
