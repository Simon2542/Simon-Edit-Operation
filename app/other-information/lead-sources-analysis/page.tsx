"use client"

import React, { useState, useEffect, useMemo } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, TrendingUp, Users, DollarSign, Target, Award, Activity, LineChart } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

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
  latest_date?: string
  [key: string]: any
}

interface ChartDataPoint {
  date: string
  settledDeals30DayAvg: number
  rednoteDeals30DayAvg: number
}


export default function LeadSourcesAnalysisPage() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load deals data from sessionStorage (same as deals dashboard)
  useEffect(() => {
    const loadDeals = () => {
      try {
        setIsLoading(true)
        const storedDeals = sessionStorage.getItem('dashboard-deals-data')
        if (storedDeals) {
          const parsedDeals = JSON.parse(storedDeals)
          setDeals(parsedDeals)
          setError(null)
        } else {
          setError("No data found. Please upload deals data in the dashboard first.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setIsLoading(false)
      }
    }
    
    // Set a small delay to ensure loading state is visible
    const timer = setTimeout(() => {
      loadDeals()
    }, 100)
    
    return () => clearTimeout(timer)
  }, [])

  // Calculate 30-day rolling average (30 days before, 0 after)
  const calculate30DayRollingAvg = (dateValueMap: Record<string, number>, targetDate: string, allAvailableDates: string[]): number => {
    const current = new Date(targetDate)
    const thirtyDaysBefore = new Date(current.getTime() - (30 * 24 * 60 * 60 * 1000))
    
    let sum = 0
    
    // Check if we have any data
    if (allAvailableDates.length === 0) return 0
    
    // Sum up all deals within the 30-day window (only count dates that actually have data)
    for (const [date, count] of Object.entries(dateValueMap)) {
      const dateObj = new Date(date)
      if (dateObj >= thirtyDaysBefore && dateObj <= current) {
        sum += count
      }
    }
    
    // Return the 30-day rolling sum divided by 30 (standard rolling average approach)
    // This gives us the average daily rate over the 30-day period
    return sum / 30
  }

  // Generate chart data with latest dates
  const chartData = useMemo((): ChartDataPoint[] => {
    if (!deals.length) return []

    // Group settled deals by date using latest_date - count unique Deal IDs per date
    const settledByDate = deals
      .filter(deal => deal.status === "6. Settled")
      .reduce((acc, deal) => {
        const date = deal.latest_date || deal.created_date
        if (date && date.trim() !== '') {
          if (!acc[date]) {
            acc[date] = new Set()
          }
          acc[date].add(deal.deal_id)
        }
        return acc
      }, {} as Record<string, Set<string>>)

    // Convert sets to counts
    const settledCountByDate = Object.entries(settledByDate).reduce((acc, [date, dealIds]) => {
      acc[date] = dealIds.size
      return acc
    }, {} as Record<string, number>)

    // Group Rednote deals by date (any status) using latest_date - count unique Deal IDs per date
    const rednoteByDate = deals
      .filter(deal => deal["From Rednote?"] === "Yes")
      .reduce((acc, deal) => {
        const date = deal.latest_date || deal.created_date
        if (date && date.trim() !== '') {
          if (!acc[date]) {
            acc[date] = new Set()
          }
          acc[date].add(deal.deal_id)
        }
        return acc
      }, {} as Record<string, Set<string>>)

    // Convert sets to counts
    const rednoteCountByDate = Object.entries(rednoteByDate).reduce((acc, [date, dealIds]) => {
      acc[date] = dealIds.size
      return acc
    }, {} as Record<string, number>)

    // Get all unique dates and sort them (using latest_date priority)
    const allDates = Array.from(new Set([
      ...deals.map(deal => deal.latest_date || deal.created_date).filter(date => date && date.trim() !== '')
    ])).sort()

    if (allDates.length === 0) return [] // Need at least some dates

    // Calculate rolling averages for each date
    const result: ChartDataPoint[] = allDates.map(date => ({
      date,
      settledDeals30DayAvg: calculate30DayRollingAvg(settledCountByDate, date, allDates),
      rednoteDeals30DayAvg: calculate30DayRollingAvg(rednoteCountByDate, date, allDates)
    }))

    // Return only the latest 90 days of data for better visualization
    return result.slice(-90)
  }, [deals])

  // Calculate Y-axis domains based on data range
  const yAxisDomains = useMemo(() => {
    if (chartData.length === 0) {
      return { leftDomain: [0, 10], rightDomain: [0, 10] }
    }

    const settledValues = chartData.map(d => d.settledDeals30DayAvg).filter(v => v > 0)
    const rednoteValues = chartData.map(d => d.rednoteDeals30DayAvg).filter(v => v > 0)
    
    // Calculate domains for left axis (settled deals)
    const maxSettled = settledValues.length > 0 ? Math.max(...settledValues) : 1
    const minSettled = settledValues.length > 0 ? Math.min(...settledValues) : 0
    const leftPadding = Math.max((maxSettled - minSettled) * 0.1, maxSettled * 0.05)
    const leftDomain = [
      Math.max(0, minSettled - leftPadding),
      maxSettled + leftPadding
    ]

    // Calculate domains for right axis (rednote deals)
    const maxRednote = rednoteValues.length > 0 ? Math.max(...rednoteValues) : 1
    const minRednote = rednoteValues.length > 0 ? Math.min(...rednoteValues) : 0
    const rightPadding = Math.max((maxRednote - minRednote) * 0.1, maxRednote * 0.05)
    const rightDomain = [
      Math.max(0, minRednote - rightPadding),
      maxRednote + rightPadding
    ]

    return { leftDomain, rightDomain }
  }, [chartData])

  // Format date for display
  const formatDateForDisplay = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric' 
    })
  }

  // Format date for X-axis
  const formatDateForAxis = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: '2-digit'
    })
  }

  // Calculate summary metrics from actual data
  const summaryMetrics = useMemo(() => {
    if (!deals.length) return {
      totalLeads: 0,
      conversionRate: 0,
      avgDealValue: 0,
      rednoteLeads: 0,
      lifexLeads: 0,
      otherLeads: 0,
      settledDeals: 0,
      rednotePercentage: 0,
      lifexPercentage: 0,
      rednoteConversionRate: 0,
      lifexConversionRate: 0,
      otherConversionRate: 0
    }

    const totalLeads = deals.length
    const settledDeals = deals.filter(deal => deal.status === "6. Settled").length
    const conversionRate = totalLeads > 0 ? (settledDeals / totalLeads) * 100 : 0
    
    const dealValues = deals
      .filter(deal => deal.deal_value && deal.deal_value > 0)
      .map(deal => deal.deal_value)
    const avgDealValue = dealValues.length > 0 ? dealValues.reduce((a, b) => a + b, 0) / dealValues.length : 0
    
    const rednoteLeads = deals.filter(deal => deal["From Rednote?"] === "Yes").length
    const lifexLeads = deals.filter(deal => deal["From LifeX?"] === "Yes").length
    const otherLeads = totalLeads - rednoteLeads - lifexLeads
    
    const rednotePercentage = totalLeads > 0 ? (rednoteLeads / totalLeads) * 100 : 0
    const lifexPercentage = totalLeads > 0 ? (lifexLeads / totalLeads) * 100 : 0
    
    // Calculate conversion rates by source
    const rednoteSettledDeals = deals.filter(deal => deal["From Rednote?"] === "Yes" && deal.status === "6. Settled").length
    const lifexSettledDeals = deals.filter(deal => deal["From LifeX?"] === "Yes" && deal.status === "6. Settled").length
    const otherSettledDeals = deals.filter(deal => deal["From Rednote?"] !== "Yes" && deal["From LifeX?"] !== "Yes" && deal.status === "6. Settled").length
    
    const rednoteConversionRate = rednoteLeads > 0 ? (rednoteSettledDeals / rednoteLeads) * 100 : 0
    const lifexConversionRate = lifexLeads > 0 ? (lifexSettledDeals / lifexLeads) * 100 : 0
    const otherConversionRate = otherLeads > 0 ? (otherSettledDeals / otherLeads) * 100 : 0

    return {
      totalLeads,
      conversionRate,
      avgDealValue,
      rednoteLeads,
      lifexLeads,
      otherLeads,
      settledDeals,
      rednotePercentage,
      lifexPercentage,
      rednoteConversionRate,
      lifexConversionRate,
      otherConversionRate
    }
  }, [deals])
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
                <p className="text-2xl font-bold text-gray-800">{summaryMetrics.totalLeads.toLocaleString()}</p>
                <p className="text-xs text-gray-600 mt-1">Total deals in dataset</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <Target className="h-5 w-5" />
                  <span className="text-sm font-medium">Conversion Rate</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">{summaryMetrics.conversionRate.toFixed(1)}%</p>
                <p className="text-xs text-gray-600 mt-1">Deals reaching settled status</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <DollarSign className="h-5 w-5" />
                  <span className="text-sm font-medium">Avg. Deal Value</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">${(summaryMetrics.avgDealValue / 1000).toFixed(0)}K</p>
                <p className="text-xs text-gray-600 mt-1">Average deal value</p>
              </div>
              <div className="bg-white/80 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-violet mb-2">
                  <Award className="h-5 w-5" />
                  <span className="text-sm font-medium">Best Source</span>
                </div>
                <p className="text-2xl font-bold text-gray-800">
                  {summaryMetrics.rednotePercentage > summaryMetrics.lifexPercentage ? 'Rednote' : 'LifeX'}
                </p>
                <p className="text-xs text-gray-600 mt-1">
                  {Math.max(summaryMetrics.rednotePercentage, summaryMetrics.lifexPercentage).toFixed(1)}% of total leads
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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
            ) : chartData.length === 0 ? (
              <div className="h-80 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-gray-600 mb-2">No sufficient data for rolling averages</p>
                  <p className="text-sm text-gray-500">Need at least 7 days of data span to generate chart</p>
                  {deals.length > 0 && (
                    <div className="mt-4 text-sm text-gray-600">
                      <p>Total deals: {deals.length}</p>
                      <p>Settled deals: {deals.filter(d => d.status === "6. Settled").length}</p>
                      <p>Rednote deals: {deals.filter(d => d["From Rednote?"] === "Yes").length}</p>
                      <p>Date range: {(() => {
                        const dates = deals.map(d => d.latest_date || d.created_date).filter(d => d && d.trim() !== '').sort()
                        if (dates.length === 0) return 'No valid dates (checked latest_date and created_date)'
                        const span = dates.length > 1 ? Math.ceil((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (1000 * 60 * 60 * 24)) + 1 : 0
                        return `${dates[0]} to ${dates[dates.length - 1]} (${span} days)`
                      })()}</p>
                      <p>Using field: {deals.some(d => d.latest_date) ? 'latest_date' : 'created_date'}</p>
                      <div className="text-xs mt-2 bg-gray-50 p-2 rounded">
                        <p><strong>Raw Data Debug:</strong></p>
                        <p>Status values found: {Array.from(new Set(deals.map(d => d.status))).slice(0, 5).join(', ')}</p>
                        <p>Rednote values found: {Array.from(new Set(deals.map(d => d["From Rednote?"]))).join(', ')}</p>
                        <p>Settled deals (raw): {deals.filter(d => d.status === "6. Settled").length}</p>
                        <p>Rednote deals (raw): {deals.filter(d => d["From Rednote?"] === "Yes").length}</p>
                        <p>Sample deal IDs: {deals.slice(0, 3).map(d => d.deal_id).join(', ')}</p>
                        <p>Sample statuses: {deals.slice(0, 3).map(d => d.status).join(', ')}</p>
                        <p>Sample dates: {deals.slice(0, 3).map(d => d.latest_date || d.created_date).join(', ')}</p>
                        <p>Unique dates count: {(() => {
                          const dates = deals.map(d => d.latest_date || d.created_date).filter(d => d && d.trim() !== '')
                          return new Set(dates).size
                        })()}</p>
                        <p>Date range span days: {(() => {
                          const dates = deals.map(d => d.latest_date || d.created_date).filter(d => d && d.trim() !== '').sort()
                          if (dates.length < 2) return 0
                          return Math.ceil((new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (1000 * 60 * 60 * 24))
                        })()}</p>
                        <p>Sample settled by date: {(() => {
                          const settled = deals.filter(d => d.status === "6. Settled")
                          const byDate = settled.reduce((acc, d) => {
                            const date = d.latest_date || d.created_date
                            if (date) acc[date] = (acc[date] || 0) + 1
                            return acc
                          }, {})
                          return Object.entries(byDate).slice(0, 3).map(([date, count]) => `${date}:${count}`).join(', ')
                        })()}</p>
                      </div>
                      <p>Sample data points: {chartData.length}</p>
                      {chartData.length > 0 && (
                        <div className="text-xs mt-2">
                          <p>Settled range: {yAxisDomains.leftDomain[0].toFixed(2)} - {yAxisDomains.leftDomain[1].toFixed(2)}</p>
                          <p>Rednote range: {yAxisDomains.rightDomain[0].toFixed(2)} - {yAxisDomains.rightDomain[1].toFixed(2)}</p>
                          <p>Sample values: Settled={chartData.slice(0,3).map(d => d.settledDeals30DayAvg.toFixed(2)).join(', ')}</p>
                          <p>Sample values: Rednote={chartData.slice(0,3).map(d => d.rednoteDeals30DayAvg.toFixed(2)).join(', ')}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
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
                    domain={yAxisDomains.leftDomain}
                    label={{ value: 'Settled Deals (30d avg)', angle: -90, position: 'insideLeft' }}
                    stroke="#751FAE"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                  />
                  <YAxis 
                    yAxisId="right"
                    orientation="right"
                    domain={yAxisDomains.rightDomain}
                    label={{ value: 'Rednote Deals (30d avg)', angle: 90, position: 'insideRight' }}
                    stroke="#FF6B6B"
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                  />
                  <Tooltip 
                    labelFormatter={(value) => `Date: ${formatDateForDisplay(value as string)}`}
                    formatter={(value: any, name: string) => [
                      Number(value).toFixed(2), 
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
                    dot={true}
                    dotSize={3}
                    connectNulls={true}
                    name="Settled Deals (30d avg)"
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="rednoteDeals30DayAvg" 
                    stroke="#FF6B6B" 
                    strokeWidth={2}
                    dot={true}
                    dotSize={3}
                    connectNulls={true}
                    name="Rednote Deals (30d avg)"
                  />
                </RechartsLineChart>
              </ResponsiveContainer>
            )}
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
                {summaryMetrics.totalLeads > 0 ? (
                  <>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">RedNote</span>
                        <span className="text-sm text-gray-600">
                          {summaryMetrics.rednoteLeads} leads ({summaryMetrics.rednotePercentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" 
                             style={{width: `${summaryMetrics.rednotePercentage}%`}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">LifeX Platform</span>
                        <span className="text-sm text-gray-600">
                          {summaryMetrics.lifexLeads} leads ({summaryMetrics.lifexPercentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" 
                             style={{width: `${summaryMetrics.lifexPercentage}%`}}></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium">Other Sources</span>
                        <span className="text-sm text-gray-600">
                          {summaryMetrics.totalLeads - summaryMetrics.rednoteLeads - summaryMetrics.lifexLeads} leads ({(100 - summaryMetrics.rednotePercentage - summaryMetrics.lifexPercentage).toFixed(1)}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-gradient-to-r from-violet to-pink-500 h-2 rounded-full" 
                             style={{width: `${100 - summaryMetrics.rednotePercentage - summaryMetrics.lifexPercentage}%`}}></div>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
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
                {summaryMetrics.totalLeads > 0 ? (
                  <>
                    {summaryMetrics.rednoteLeads > 0 && (
                      <div className={`p-3 rounded-lg border ${
                        summaryMetrics.rednoteConversionRate >= 20 ? 'bg-green-50 border-green-200' :
                        summaryMetrics.rednoteConversionRate >= 15 ? 'bg-blue-50 border-blue-200' :
                        summaryMetrics.rednoteConversionRate >= 10 ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${
                            summaryMetrics.rednoteConversionRate >= 20 ? 'text-green-800' :
                            summaryMetrics.rednoteConversionRate >= 15 ? 'text-blue-800' :
                            summaryMetrics.rednoteConversionRate >= 10 ? 'text-yellow-800' :
                            'text-red-800'
                          }`}>RedNote</span>
                          <Badge className={`${
                            summaryMetrics.rednoteConversionRate >= 20 ? 'bg-green-100 text-green-800' :
                            summaryMetrics.rednoteConversionRate >= 15 ? 'bg-blue-100 text-blue-800' :
                            summaryMetrics.rednoteConversionRate >= 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>{summaryMetrics.rednoteConversionRate.toFixed(1)}% CVR</Badge>
                        </div>
                        <p className={`text-xs mt-1 ${
                          summaryMetrics.rednoteConversionRate >= 20 ? 'text-green-600' :
                          summaryMetrics.rednoteConversionRate >= 15 ? 'text-blue-600' :
                          summaryMetrics.rednoteConversionRate >= 10 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {summaryMetrics.rednoteConversionRate >= 20 ? 'Excellent performance' :
                           summaryMetrics.rednoteConversionRate >= 15 ? 'Good performance' :
                           summaryMetrics.rednoteConversionRate >= 10 ? 'Room for improvement' :
                           'Needs optimization'}
                        </p>
                      </div>
                    )}
                    {summaryMetrics.lifexLeads > 0 && (
                      <div className={`p-3 rounded-lg border ${
                        summaryMetrics.lifexConversionRate >= 20 ? 'bg-green-50 border-green-200' :
                        summaryMetrics.lifexConversionRate >= 15 ? 'bg-blue-50 border-blue-200' :
                        summaryMetrics.lifexConversionRate >= 10 ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${
                            summaryMetrics.lifexConversionRate >= 20 ? 'text-green-800' :
                            summaryMetrics.lifexConversionRate >= 15 ? 'text-blue-800' :
                            summaryMetrics.lifexConversionRate >= 10 ? 'text-yellow-800' :
                            'text-red-800'
                          }`}>LifeX Platform</span>
                          <Badge className={`${
                            summaryMetrics.lifexConversionRate >= 20 ? 'bg-green-100 text-green-800' :
                            summaryMetrics.lifexConversionRate >= 15 ? 'bg-blue-100 text-blue-800' :
                            summaryMetrics.lifexConversionRate >= 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>{summaryMetrics.lifexConversionRate.toFixed(1)}% CVR</Badge>
                        </div>
                        <p className={`text-xs mt-1 ${
                          summaryMetrics.lifexConversionRate >= 20 ? 'text-green-600' :
                          summaryMetrics.lifexConversionRate >= 15 ? 'text-blue-600' :
                          summaryMetrics.lifexConversionRate >= 10 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {summaryMetrics.lifexConversionRate >= 20 ? 'Excellent performance' :
                           summaryMetrics.lifexConversionRate >= 15 ? 'Good performance' :
                           summaryMetrics.lifexConversionRate >= 10 ? 'Room for improvement' :
                           'Needs optimization'}
                        </p>
                      </div>
                    )}
                    {summaryMetrics.otherLeads > 0 && (
                      <div className={`p-3 rounded-lg border ${
                        summaryMetrics.otherConversionRate >= 20 ? 'bg-green-50 border-green-200' :
                        summaryMetrics.otherConversionRate >= 15 ? 'bg-blue-50 border-blue-200' :
                        summaryMetrics.otherConversionRate >= 10 ? 'bg-yellow-50 border-yellow-200' :
                        'bg-red-50 border-red-200'
                      }`}>
                        <div className="flex justify-between items-center">
                          <span className={`font-medium ${
                            summaryMetrics.otherConversionRate >= 20 ? 'text-green-800' :
                            summaryMetrics.otherConversionRate >= 15 ? 'text-blue-800' :
                            summaryMetrics.otherConversionRate >= 10 ? 'text-yellow-800' :
                            'text-red-800'
                          }`}>Other Sources</span>
                          <Badge className={`${
                            summaryMetrics.otherConversionRate >= 20 ? 'bg-green-100 text-green-800' :
                            summaryMetrics.otherConversionRate >= 15 ? 'bg-blue-100 text-blue-800' :
                            summaryMetrics.otherConversionRate >= 10 ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>{summaryMetrics.otherConversionRate.toFixed(1)}% CVR</Badge>
                        </div>
                        <p className={`text-xs mt-1 ${
                          summaryMetrics.otherConversionRate >= 20 ? 'text-green-600' :
                          summaryMetrics.otherConversionRate >= 15 ? 'text-blue-600' :
                          summaryMetrics.otherConversionRate >= 10 ? 'text-yellow-600' :
                          'text-red-600'
                        }`}>
                          {summaryMetrics.otherConversionRate >= 20 ? 'Excellent performance' :
                           summaryMetrics.otherConversionRate >= 15 ? 'Good performance' :
                           summaryMetrics.otherConversionRate >= 10 ? 'Room for improvement' :
                           'Needs optimization'}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-gray-500 text-center py-4">No data available</p>
                )}
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