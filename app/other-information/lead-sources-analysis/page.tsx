"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Award, Activity, LineChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Deal {
  deal_id: string
  deal_name: string
  broker_name: string
  status: string
  deal_value: number
  "From Rednote?": string
  "From LifeX?": string
  "Lost date": string
  created_date: string
  [key: string]: any
}

interface ChartDataPoint {
  date: string
  settledDeals30DayAvg: number | null
  rednoteDeals30DayAvg: number | null
}

export default function LeadSourcesAnalysisPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<string>("all")

  // Load deals data
  useEffect(() => {
    const loadDeals = async () => {
      try {
        setIsLoading(true)
        // Generate sample data for demonstration
        const sampleDeals: Deal[] = generateSampleDeals()
        setDeals(sampleDeals)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    loadDeals()
  }, [])

  // Generate sample deals data
  const generateSampleDeals = (): Deal[] => {
    const deals: Deal[] = []
    const startDate = new Date('2023-01-01')
    const endDate = new Date('2025-01-10')
    
    for (let i = 0; i < 2000; i++) {
      const randomDate = new Date(startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime()))
      const isRednote = Math.random() < 0.25 // 25% are from Rednote
      const isSettled = Math.random() < 0.15 // 15% are settled
      
      deals.push({
        deal_id: `deal_${i}`,
        deal_name: `Deal ${i}`,
        broker_name: `Broker ${Math.floor(Math.random() * 15)}`,
        status: isSettled ? "6. Settled" : ["1. Application", "2. Assessment", "3. Approval", "4. Loan Document", "5. Settlement Queue", "Lost"][Math.floor(Math.random() * 6)],
        deal_value: Math.floor(Math.random() * 1500000),
        "From Rednote?": isRednote ? "Yes" : "No",
        "From LifeX?": !isRednote && Math.random() < 0.35 ? "Yes" : "No",
        "Lost date": "",
        "created_date": randomDate.toISOString().split('T')[0]
      })
    }
    
    return deals.sort((a, b) => new Date(a.created_date).getTime() - new Date(b.created_date).getTime())
  }

  // Calculate 30-day rolling average (30 days before, 0 after)
  const calculate30DayRollingSum = (dateValueMap: Record<string, number>, targetDate: string): number | null => {
    const current = new Date(targetDate)
    const thirtyDaysBefore = new Date(current)
    thirtyDaysBefore.setDate(current.getDate() - 30)
    
    let sum = 0
    let dayCount = 0
    
    // Iterate through each day in the 30-day window (30 days before to current day inclusive)
    for (let d = new Date(thirtyDaysBefore); d <= current; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0]
      sum += dateValueMap[dateStr] || 0
      dayCount++
    }
    
    // Return average only if we have 30+ days of data
    return dayCount >= 30 ? sum / 30 : null
  }

  // Generate chart data
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!deals.length) return []

    // Filter deals by selected year
    const filteredDeals = selectedYear === "all" 
      ? deals 
      : deals.filter(deal => {
          const dealYear = new Date(deal.created_date).getFullYear().toString()
          return dealYear === selectedYear
        })

    // Group settled deals by date
    const settledByDate = filteredDeals
      .filter(deal => deal.status === "6. Settled")
      .reduce((acc, deal) => {
        const date = deal.created_date
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    // Group Rednote deals by date (any status)
    const rednoteByDate = filteredDeals
      .filter(deal => deal["From Rednote?"] === "Yes")
      .reduce((acc, deal) => {
        const date = deal.created_date
        acc[date] = (acc[date] || 0) + 1
        return acc
      }, {} as Record<string, number>)

    // Get all unique dates and sort them
    const allDates = Array.from(new Set([
      ...Object.keys(settledByDate),
      ...Object.keys(rednoteByDate)
    ])).sort()

    // Calculate rolling averages for each date
    const result: ChartDataPoint[] = allDates.map(date => ({
      date,
      settledDeals30DayAvg: calculate30DayRollingSum(settledByDate, date),
      rednoteDeals30DayAvg: calculate30DayRollingSum(rednoteByDate, date)
    }))

    // Filter to only include dates with at least one non-null value
    return result.filter(d => d.settledDeals30DayAvg !== null || d.rednoteDeals30DayAvg !== null)
  }, [deals, selectedYear])

  // Get available years from deals data
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    deals.forEach(deal => {
      if (deal.created_date) {
        years.add(new Date(deal.created_date).getFullYear().toString())
      }
    })
    return Array.from(years).sort().reverse()
  }, [deals])

  // Format date for display (dd/mm/yyyy format)
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  // Format date for X-axis (shorter format for space)
  const formatDateForAxis = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit'
    })
  }
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-100">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-violet/10 to-pink-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-pink-200/30 to-violet/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 p-6 sticky top-0 bg-white/95 backdrop-blur-xl border-b border-violet/20 shadow-lg">
        <Link href="/other-information" className="absolute left-6 top-1/2 transform -translate-y-1/2">
          <Button
            variant="outline"
            size="sm"
            className="bg-white/60 border-violet/30 text-violet hover:bg-violet hover:text-white transition-all"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Information Hub
          </Button>
        </Link>
        
        <div className="text-center">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-700 via-pink-600 to-purple-700 bg-clip-text text-transparent">
            Lead Sources Analysis
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Comprehensive Lead Generation Insights
          </p>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12 max-w-7xl">
        {/* 30-Day Rolling Average Chart */}
        <Card className="mb-8 bg-white/90 backdrop-blur border-violet/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-black">
                  <LineChart className="h-5 w-5 text-violet" />
                  Lead Sources Analysis - 30-Day Rolling Average
                </CardTitle>
                <CardDescription>
                  Settled deals vs Rednote source deals - 30-day rolling averages (30 days before, 0 after)
                </CardDescription>
              </div>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Filter by year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-violet mx-auto"></div>
                  <p className="text-gray-600 mt-2">Loading chart data...</p>
                </div>
              </div>
            ) : error ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-red-600">{error}</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={450}>
                <RechartsLineChart data={chartData} margin={{ top: 20, right: 60, left: 60, bottom: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={formatDateForAxis}
                    stroke="#666"
                    tick={{ fontSize: 10 }}
                    angle={-45}
                    textAnchor="end"
                    height={80}
                    interval="preserveStartEnd"
                  />
                  <YAxis 
                    yAxisId="left"
                    label={{ value: 'Settled Deals (30d avg)', angle: -90, position: 'insideLeft' }}
                    stroke="#751FAE"
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    label={{ value: 'Rednote Deals (30d avg)', angle: 90, position: 'insideRight' }}
                    stroke="#FF6B6B"
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip 
                    labelFormatter={(value) => `Date: ${formatDateForDisplay(value as string)}`}
                    formatter={(value: any, name: string) => [
                      value !== null ? Number(value).toFixed(2) : 'N/A (insufficient data)', 
                      name === 'settledDeals30DayAvg' ? 'Settled Deals (30d avg)' : 'Rednote Deals (30d avg)'
                    ]}
                  />
                  <Legend />
                  <Line 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="settledDeals30DayAvg" 
                    stroke="#751FAE" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name="Settled Deals (30d avg)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="rednoteDeals30DayAvg" 
                    stroke="#FF6B6B" 
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                    name="Rednote Deals (30d avg)"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Hero Section */}
        <Card className="mb-8 bg-gradient-to-r from-violet/10 to-pink-200/20 border-violet/20">
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl">Executive Summary</CardTitle>
                <CardDescription className="mt-2 text-base">
                  Analysis of lead generation performance across all channels for Q1 2025
                </CardDescription>
              </div>
              <Badge className="bg-green-100 text-green-800 border-green-300">
                Live Data
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <Users className="h-5 w-5" />
                  <span className="text-sm font-medium">Total Leads</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">2,847</p>
                <p className="text-xs text-green-600 mt-1">+23% vs last month</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <Target className="h-5 w-5" />
                  <span className="text-sm font-medium">Conversion Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">18.5%</p>
                <p className="text-xs text-green-600 mt-1">+2.3% improvement</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Avg. Deal Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">$487K</p>
                <p className="text-xs text-red-600 mt-1">-5% vs last month</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <Award className="h-5 w-5" />
                  <span className="text-sm font-medium">Best Source</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">Referrals</p>
                <p className="text-xs text-gray-600 mt-1">32% of total leads</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Analysis Sections */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-white/90 backdrop-blur border-violet/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-violet" />
                Lead Sources Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Referrals</span>
                    <span className="text-sm text-gray-600">912 leads (32%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" style={{width: "32%"}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">LifeX Platform</span>
                    <span className="text-sm text-gray-600">741 leads (26%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" style={{width: "26%"}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">RedNote</span>
                    <span className="text-sm text-gray-600">569 leads (20%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" style={{width: "20%"}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Direct Marketing</span>
                    <span className="text-sm text-gray-600">427 leads (15%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" style={{width: "15%"}}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium">Others</span>
                    <span className="text-sm text-gray-600">198 leads (7%)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" style={{width: "7%"}}></div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 backdrop-blur border-violet/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-violet" />
                Conversion Performance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-green-800">Referrals</span>
                    <Badge className="bg-green-100 text-green-800">28.5% CVR</Badge>
                  </div>
                  <p className="text-xs text-green-600 mt-1">Best performing channel</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-blue-800">LifeX Platform</span>
                    <Badge className="bg-blue-100 text-blue-800">22.1% CVR</Badge>
                  </div>
                  <p className="text-xs text-blue-600 mt-1">Above average performance</p>
                </div>
                <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-yellow-800">RedNote</span>
                    <Badge className="bg-yellow-100 text-yellow-800">15.3% CVR</Badge>
                  </div>
                  <p className="text-xs text-yellow-600 mt-1">Room for improvement</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-red-800">Direct Marketing</span>
                    <Badge className="bg-red-100 text-red-800">8.7% CVR</Badge>
                  </div>
                  <p className="text-xs text-red-600 mt-1">Needs optimization</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recommendations */}
        <Card className="mt-6 bg-white/90 backdrop-blur border-violet/20">
          <CardHeader>
            <CardTitle>Key Recommendations</CardTitle>
            <CardDescription>Strategic actions based on current analysis</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-violet font-bold text-sm">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Expand Referral Program</p>
                  <p className="text-sm text-gray-600 mt-1">
                    With 28.5% conversion rate, referrals are your best performing channel. Consider implementing incentive programs to boost referral volume.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-violet font-bold text-sm">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Optimize Direct Marketing Strategy</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Current 8.7% conversion rate indicates inefficiency. Review targeting criteria and messaging to improve performance.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-violet/20 flex items-center justify-center flex-shrink-0">
                  <span className="text-violet font-bold text-sm">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-800">Scale LifeX Platform Investment</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Strong 22.1% conversion with room to grow. Increase budget allocation to capture more high-quality leads.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer Actions */}
        <div className="mt-8 flex justify-between items-center">
          <Link href="/other-information">
            <Button variant="outline" className="border-violet/30 text-violet hover:bg-violet hover:text-white">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Hub
            </Button>
          </Link>
          <div className="flex gap-3">
            <Button variant="outline" className="border-violet/30 text-violet">
              Export Report
            </Button>
            <Button className="bg-gradient-to-r from-violet to-pink-500 text-white">
              Share Analysis
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}