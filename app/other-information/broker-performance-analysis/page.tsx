"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Slider } from "@/components/ui/slider"
import { ArrowLeft, TrendingUp, TrendingDown, Target, Users, DollarSign, FileText, AlertTriangle, Upload, Filter, BarChart3 } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, LabelList } from "recharts"
import * as XLSX from "xlsx"

interface Deal {
  deal_id: string;
  deal_name: string;
  broker_name: string;
  deal_value: number;
  created_time?: string | null;
  "Enquiry Leads": string | null;
  Opportunity: string | null;
  "1. Application": string | null;
  "2. Assessment": string | null;
  "3. Approval": string | null;
  "4. Loan Document": string | null;
  "5. Settlement Queue": string | null;
  "6. Settled": string | null;
  "2025 Settlement": string | null;
  "2024 Settlement": string | null;
  "Lost date": string | null;
  "lost reason": string | null;
  "which process (if lost)": string | null;
  status: string;
  "process days": number | null;
  latest_date: string | null;
  "new_lead?": string | null;
  "From Rednote?": string;
  "From LifeX?": string;
}

interface BrokerPerformance {
  brokerName: string;
  totalDeals: number;
  settledDeals: number;
  settledRate: number;
  settledValue: number;
  avgDealValue: number;
  conversionRate: number;
  convertedDeals: number;
}

const formatCurrency = (value: number) => new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
}).format(value);

export default function BrokerPerformanceAnalysisPage() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [minDealsThreshold, setMinDealsThreshold] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedMode, setSelectedMode] = useState<'settled' | 'conversion'>('settled');
  const [selectedBroker, setSelectedBroker] = useState<string>('all');
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [threshold, setThreshold] = useState<number>(20);

  // Load deals from sessionStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDeals = sessionStorage.getItem('dashboard-deals-data');
        if (savedDeals) {
          setDeals(JSON.parse(savedDeals));
        }
      } catch (error) {
        console.error('Error loading deals from sessionStorage:', error);
      }
    }
  }, []);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (fileExtension === "json") {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        let dealsArray: Deal[];
        
        if (Array.isArray(jsonData)) {
          dealsArray = jsonData;
        } else if (jsonData.deals && Array.isArray(jsonData.deals)) {
          dealsArray = jsonData.deals;
        } else {
          throw new Error("Invalid JSON structure.");
        }
        
        setDeals(dealsArray);
        setError(null);
        
        // Save to sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('dashboard-deals-data', JSON.stringify(dealsArray));
        }
        
      } else if (fileExtension === "xlsx" || fileExtension === "xls") {
        const arrayBuffer = await file.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        
        const headers = (jsonData[0] as string[]).map(h => h.trim());
        const dealsArray: Deal[] = (jsonData.slice(1) as any[][]).map((row, index) => {
          const deal: any = {};
          headers.forEach((header, colIndex) => {
            deal[header] = row[colIndex] ?? null;
          });
          
          deal.deal_id = String(deal.deal_id || `excel_${index + 1}`);
          deal.deal_name = String(deal.deal_name || `Deal ${index + 1}`);
          deal.broker_name = String(deal.broker_name || "Unknown Broker");
          deal.status = String(deal.status || "Unknown");
          
          const dealValue = deal.deal_value;
          if (typeof dealValue === 'string') {
            deal.deal_value = Number(dealValue.replace(/[^0-9.-]+/g,"")) || 0;
          } else if (typeof dealValue !== 'number') {
            deal.deal_value = 0;
          }
          
          Object.keys(deal).forEach(key => {
            const value = deal[key];
            if (value && (value instanceof Date)) {
              deal[key] = value.toISOString();
            }
          });
          
          return deal as Deal;
        }).filter((deal) => deal.deal_name && deal.deal_name.trim() !== "");
        
        setDeals(dealsArray);
        setError(null);
        
        // Save to sessionStorage
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('dashboard-deals-data', JSON.stringify(dealsArray));
        }
        
      } else {
        throw new Error("Unsupported file format. Please upload a JSON or Excel (.xlsx/.xls) file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setDeals([]);
      
      // Clear sessionStorage on error
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('dashboard-deals-data');
      }
    } finally {
      setIsLoading(false);
      // Reset file input
      event.target.value = '';
    }
  }, []);

  // Get available years from latest_date
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    deals.forEach(deal => {
      if (deal.latest_date) {
        const year = new Date(deal.latest_date).getFullYear().toString();
        if (!isNaN(parseInt(year))) {
          years.add(year);
        }
      }
    });
    return Array.from(years).sort((a, b) => parseInt(b) - parseInt(a));
  }, [deals]);

  // Fixed broker list - only Amy and Jo
  const availableBrokers = ['Miao (Amy)', 'QianShuo(Jo)'];

  // Filter deals based on criteria
  const filteredDeals = useMemo(() => {
    let filtered = deals;

    // Filter by broker
    if (selectedBroker !== 'all') {
      filtered = filtered.filter(deal => deal.broker_name === selectedBroker);
    }

    // Filter by year (using latest_date)
    if (selectedYear !== 'all') {
      filtered = filtered.filter(deal => {
        if (!deal.latest_date) return false;
        const year = new Date(deal.latest_date).getFullYear().toString();
        return year === selectedYear;
      });
    }

    return filtered;
  }, [deals, selectedBroker, selectedYear]);

  const brokerPerformance = useMemo((): BrokerPerformance[] => {
    if (!filteredDeals || filteredDeals.length === 0) return [];

    const brokerStats = filteredDeals.reduce((acc, deal) => {
      const brokerName = deal.broker_name;
      if (!acc[brokerName]) {
        acc[brokerName] = {
          deals: [],
          settled: 0,
          settledValue: 0,
          converted: 0
        };
      }
      
      acc[brokerName].deals.push(deal);
      
      // Check if settled
      if (deal["6. Settled"] && deal["6. Settled"].trim() !== "") {
        acc[brokerName].settled++;
        acc[brokerName].settledValue += deal.deal_value || 0;
      }
      
      // Check if converted (any stage beyond enquiry)
      const isConverted = (
        (deal["1. Application"] && deal["1. Application"].trim() !== "") ||
        (deal["2. Assessment"] && deal["2. Assessment"].trim() !== "") ||
        (deal["3. Approval"] && deal["3. Approval"].trim() !== "") ||
        (deal["4. Loan Document"] && deal["4. Loan Document"].trim() !== "") ||
        (deal["5. Settlement Queue"] && deal["5. Settlement Queue"].trim() !== "") ||
        (deal["6. Settled"] && deal["6. Settled"].trim() !== "") ||
        (deal["2025 Settlement"] && deal["2025 Settlement"].trim() !== "") ||
        (deal["2024 Settlement"] && deal["2024 Settlement"].trim() !== "")
      );
      
      if (isConverted) {
        acc[brokerName].converted++;
      }
      
      return acc;
    }, {} as Record<string, { deals: Deal[], settled: number, settledValue: number, converted: number }>);

    return Object.entries(brokerStats).map(([brokerName, stats]) => {
      const totalDeals = stats.deals.length;
      const settledRate = totalDeals > 0 ? (stats.settled / totalDeals) * 100 : 0;
      const conversionRate = totalDeals > 0 ? (stats.converted / totalDeals) * 100 : 0;
      const avgDealValue = stats.settled > 0 ? stats.settledValue / stats.settled : 0;

      return {
        brokerName,
        totalDeals,
        settledDeals: stats.settled,
        settledRate,
        settledValue: stats.settledValue,
        avgDealValue,
        conversionRate,
        convertedDeals: stats.converted
      };
    }).sort((a, b) => selectedMode === 'settled' ? b.settledValue - a.settledValue : b.conversionRate - a.conversionRate);
  }, [filteredDeals, selectedMode]);

  const filteredBrokers = useMemo(() => {
    return brokerPerformance.filter(broker => broker.totalDeals >= minDealsThreshold);
  }, [brokerPerformance, minDealsThreshold]);

  const performanceSummary = useMemo(() => {
    // Find the selected broker's performance
    const selectedBrokerData = brokerPerformance.find(b => b.brokerName === selectedBroker);
    
    // Calculate selected broker's rate based on analysis mode
    const selectedBrokerRate = selectedBrokerData 
      ? (selectedMode === 'settled' ? selectedBrokerData.settledRate : selectedBrokerData.conversionRate)
      : 0;
    
    // Calculate average deals per 7 days for selected broker
    let avgDealsPerWeek = 0;
    if (selectedBroker !== 'all' && filteredDeals.length > 0) {
      const brokerDeals = filteredDeals.filter(deal => deal.broker_name === selectedBroker);
      
      if (brokerDeals.length > 0) {
        // Get date range from filtered deals
        const dates = brokerDeals
          .filter(deal => deal.latest_date)
          .map(deal => new Date(deal.latest_date!).getTime())
          .filter(time => !isNaN(time));
        
        if (dates.length > 0) {
          const minDate = Math.min(...dates);
          const maxDate = Math.max(...dates);
          const totalDays = Math.max(1, (maxDate - minDate) / (1000 * 60 * 60 * 24));
          const totalWeeks = Math.max(1, totalDays / 7);
          avgDealsPerWeek = brokerDeals.length / totalWeeks;
        }
      }
    }
    
    return {
      selectedBrokerRate,
      avgDealsPerWeek
    };
  }, [brokerPerformance, selectedBroker, selectedMode, filteredDeals]);

  // Chart data calculation - weekly performance comparison
  const chartData = useMemo(() => {
    if (selectedBroker === 'all' || filteredDeals.length === 0) {
      return [];
    }

    const brokerDeals = filteredDeals.filter(deal => deal.broker_name === selectedBroker);
    
    if (brokerDeals.length === 0) {
      return [];
    }

    // Group deals by week
    const weeklyGroups = brokerDeals.reduce((acc, deal) => {
      if (!deal.latest_date) return acc;
      
      const dealDate = new Date(deal.latest_date);
      if (isNaN(dealDate.getTime())) return acc;
      
      // Get week start (Monday)
      const weekStart = new Date(dealDate);
      const day = weekStart.getDay();
      const diff = weekStart.getDate() - day + (day === 0 ? -6 : 1);
      weekStart.setDate(diff);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekKey = weekStart.toISOString().split('T')[0];
      
      if (!acc[weekKey]) {
        acc[weekKey] = {
          weekStart: weekStart,
          deals: [],
          totalDeals: 0,
          settledDeals: 0,
          convertedDeals: 0
        };
      }
      
      acc[weekKey].deals.push(deal);
      acc[weekKey].totalDeals++;
      
      // Check if settled
      if (deal["6. Settled"] && deal["6. Settled"].trim() !== "") {
        acc[weekKey].settledDeals++;
      }
      
      // Check if converted
      const isConverted = (
        (deal["1. Application"] && deal["1. Application"].trim() !== "") ||
        (deal["2. Assessment"] && deal["2. Assessment"].trim() !== "") ||
        (deal["3. Approval"] && deal["3. Approval"].trim() !== "") ||
        (deal["4. Loan Document"] && deal["4. Loan Document"].trim() !== "") ||
        (deal["5. Settlement Queue"] && deal["5. Settlement Queue"].trim() !== "") ||
        (deal["6. Settled"] && deal["6. Settled"].trim() !== "") ||
        (deal["2025 Settlement"] && deal["2025 Settlement"].trim() !== "") ||
        (deal["2024 Settlement"] && deal["2024 Settlement"].trim() !== "")
      );
      
      if (isConverted) {
        acc[weekKey].convertedDeals++;
      }
      
      return acc;
    }, {} as Record<string, {
      weekStart: Date,
      deals: Deal[],
      totalDeals: number,
      settledDeals: number,
      convertedDeals: number
    }>);

    // Group weeks by threshold categories and calculate averages
    const weeklyData = Object.entries(weeklyGroups)
      .map(([weekKey, data]) => {
        const settledRate = data.totalDeals > 0 ? (data.settledDeals / data.totalDeals) * 100 : 0;
        const conversionRate = data.totalDeals > 0 ? (data.convertedDeals / data.totalDeals) * 100 : 0;
        const rate = selectedMode === 'settled' ? settledRate : conversionRate;
        
        return {
          totalDeals: data.totalDeals,
          rate: rate,
          settledRate: settledRate,
          conversionRate: conversionRate,
          settledDeals: data.settledDeals,
          convertedDeals: data.convertedDeals,
          isAboveThreshold: data.totalDeals >= threshold
        };
      });

    // Calculate averages for each category
    const aboveThresholdWeeks = weeklyData.filter(w => w.isAboveThreshold);
    const belowThresholdWeeks = weeklyData.filter(w => !w.isAboveThreshold);

    const avgAboveThreshold = aboveThresholdWeeks.length > 0 
      ? aboveThresholdWeeks.reduce((sum, w) => sum + w.rate, 0) / aboveThresholdWeeks.length 
      : 0;
    
    const avgBelowThreshold = belowThresholdWeeks.length > 0 
      ? belowThresholdWeeks.reduce((sum, w) => sum + w.rate, 0) / belowThresholdWeeks.length 
      : 0;

    // Create chart data with two categories, excluding zeros
    const chartData = [];
    
    if (belowThresholdWeeks.length > 0) {
      chartData.push({
        category: `< ${threshold}`,
        rate: parseFloat(avgBelowThreshold.toFixed(1)),
        weekCount: belowThresholdWeeks.length,
        totalDeals: belowThresholdWeeks.reduce((sum, w) => sum + w.totalDeals, 0),
        avgSettledRate: belowThresholdWeeks.reduce((sum, w) => sum + w.settledRate, 0) / belowThresholdWeeks.length,
        avgConversionRate: belowThresholdWeeks.reduce((sum, w) => sum + w.conversionRate, 0) / belowThresholdWeeks.length
      });
    }
    
    if (aboveThresholdWeeks.length > 0) {
      chartData.push({
        category: `>= ${threshold}`,
        rate: parseFloat(avgAboveThreshold.toFixed(1)),
        weekCount: aboveThresholdWeeks.length,
        totalDeals: aboveThresholdWeeks.reduce((sum, w) => sum + w.totalDeals, 0),
        avgSettledRate: aboveThresholdWeeks.reduce((sum, w) => sum + w.settledRate, 0) / aboveThresholdWeeks.length,
        avgConversionRate: aboveThresholdWeeks.reduce((sum, w) => sum + w.conversionRate, 0) / aboveThresholdWeeks.length
      });
    }

    return chartData;
  }, [filteredDeals, selectedBroker, selectedMode, threshold]);

  const getPerformanceStatus = (broker: BrokerPerformance) => {
    const meetsThreshold = selectedMode === 'settled' 
      ? broker.settledDeals >= threshold 
      : broker.convertedDeals >= threshold;
    
    if (meetsThreshold) {
      return { status: "above-threshold", color: "bg-green-100 text-green-800", icon: TrendingUp };
    } else {
      return { status: "below-threshold", color: "bg-red-100 text-red-800", icon: AlertTriangle };
    }
  };

  if (deals.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-100">
        <header className="relative z-50 p-6 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-xl border-b border-violet/20 shadow-lg">
          <Link href="/other-information">
            <Button variant="outline" size="sm" className="bg-white/60 border-violet/30 text-violet hover:bg-violet hover:text-white transition-all">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Information Hub
            </Button>
          </Link>
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-700 via-pink-600 to-purple-700 bg-clip-text text-transparent">
            Broker Performance Analysis
          </h1>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept=".json,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              id="header-file-upload"
              disabled={isLoading}
            />
            <label htmlFor="header-file-upload">
              <Button 
                variant="outline" 
                size="sm" 
                className="bg-white/60 border-violet/30 text-violet hover:bg-violet hover:text-white transition-all" 
                disabled={isLoading}
                asChild
              >
                <span className="cursor-pointer">
                  <Upload className="h-4 w-4 mr-2" />
                  {isLoading ? "Uploading..." : "Upload Data"}
                </span>
              </Button>
            </label>
          </div>
        </header>

        <div className="container mx-auto px-6 py-12">
          <Card className="bg-white/80 border-violet/40 shadow-lg">
            <CardContent className="h-48 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-12 w-12 text-violet/50 mx-auto mb-4" />
                <p className="text-violet/80 font-medium">No data available</p>
                <p className="text-violet/60 text-sm mt-1 mb-6">Upload your data file to start analyzing broker performance</p>
                
                {error && (
                  <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                    <p className="text-red-600 text-sm">{error}</p>
                  </div>
                )}
                
                <div className="flex flex-col items-center gap-4">
                  <input
                    type="file"
                    accept=".json,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isLoading}
                  />
                  <label htmlFor="file-upload">
                    <Button 
                      className="bg-violet hover:bg-violet/90" 
                      disabled={isLoading}
                      asChild
                    >
                      <span className="cursor-pointer">
                        <Upload className="h-4 w-4 mr-2" />
                        {isLoading ? "Uploading..." : "Upload Data File"}
                      </span>
                    </Button>
                  </label>
                  
                  <div className="text-xs text-violet/60">
                    Supports JSON and Excel files (.xlsx, .xls)
                  </div>
                  
                  <div className="mt-2">
                    <Link href="/" className="inline-block">
                      <Button variant="outline" className="text-violet border-violet/30 hover:bg-violet/10">
                        Or go to Dashboard
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-100">
      {/* Header */}
      <header className="relative z-50 p-6 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-xl border-b border-violet/20 shadow-lg">
        <Link href="/other-information">
          <Button variant="outline" size="sm" className="bg-white/60 border-violet/30 text-violet hover:bg-violet hover:text-white transition-all">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Information Hub
          </Button>
        </Link>
        <h1 className="text-3xl font-black bg-gradient-to-r from-purple-700 via-pink-600 to-purple-700 bg-clip-text text-transparent">
          Broker Performance Analysis
        </h1>
        <div className="w-32"></div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8 max-w-7xl">
        
        {/* Error Message */}
        {error && (
          <Card className="bg-red-50 border-red-200 shadow-lg mb-6">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-4 w-4" />
                <span className="font-medium">Error: {error}</span>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* Filter Controls */}
        <Card className="bg-white/90 border-violet/20 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-violet flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Performance Analysis Filters
            </CardTitle>
            <CardDescription>Choose analysis mode, broker, year, and set performance threshold</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <Label htmlFor="analysisMode" className="text-black">Analysis Mode</Label>
              <Select value={selectedMode} onValueChange={(value) => setSelectedMode(value as 'settled' | 'conversion')}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="settled">Settled Analysis</SelectItem>
                  <SelectItem value="conversion">Conversion Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="brokerFilter" className="text-black">Broker Name</Label>
              <Select value={selectedBroker} onValueChange={setSelectedBroker}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select broker" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Brokers</SelectItem>
                  {availableBrokers.map(broker => (
                    <SelectItem key={broker} value={broker}>{broker}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="yearFilter" className="text-black">Year</Label>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year}>{year}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="threshold" className="text-black">
                Deals
              </Label>
              <div className="flex items-center gap-3 mt-2">
                <Slider
                  id="threshold"
                  min={0}
                  max={60}
                  step={1}
                  value={[threshold]}
                  onValueChange={(value) => setThreshold(value[0])}
                  className="flex-1"
                />
                <Input
                  type="number"
                  min={0}
                  max={60}
                  value={threshold}
                  onChange={(e) => {
                    const value = Math.min(60, Math.max(0, Number(e.target.value) || 0));
                    setThreshold(value);
                  }}
                  className="w-16 text-center"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">
                    {selectedBroker === 'all' ? 'Select a broker' : `${selectedBroker}'s ${selectedMode === 'settled' ? 'Settled' : 'Conversion'} Rate`}
                  </p>
                  <p className="text-2xl font-bold text-violet">
                    {selectedBroker === 'all' ? '--' : `${performanceSummary.selectedBrokerRate.toFixed(1)}%`}
                  </p>
                </div>
                <Target className="h-8 w-8 text-violet/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">
                    {selectedBroker === 'all' ? 'Select a broker' : `${selectedBroker}'s Avg Deals per Week`}
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {selectedBroker === 'all' ? '--' : Math.round(performanceSummary.avgDealsPerWeek * 10) / 10}
                  </p>
                </div>
                <FileText className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Bar Chart */}
        <Card className="bg-white/90 border-violet/20 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-violet flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Weekly Performance Analysis
            </CardTitle>
            <CardDescription>
              {selectedBroker === 'all' 
                ? 'Select a specific broker to view weekly performance data'
                : `${selectedBroker}'s ${selectedMode === 'settled' ? 'settled' : 'conversion'} rate by week, categorized by deal volume threshold`
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedBroker === 'all' || chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-violet/60">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>{selectedBroker === 'all' ? 'Select a broker to view chart' : 'No data available for selected criteria'}</p>
                </div>
              </div>
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                    <XAxis 
                      dataKey="category" 
                      hide={true}
                    />
                    <YAxis 
                      hide={true}
                      domain={[0, 'dataMax + 10']}
                    />
                    <Bar 
                      dataKey="rate"
                      name={`Avg ${selectedMode === 'settled' ? 'Settled' : 'Conversion'} Rate (%)`}
                      radius={[2, 2, 0, 0]}
                    >
                      {chartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.category.includes('<') ? '#dc2626' : '#16a34a'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}