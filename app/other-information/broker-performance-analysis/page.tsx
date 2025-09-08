"use client"

import React, { useState, useMemo, useEffect, useCallback } from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ArrowLeft, TrendingUp, TrendingDown, Target, Users, DollarSign, FileText, AlertTriangle, Upload } from "lucide-react"
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
  const [settledRateThreshold, setSettledRateThreshold] = useState<number>(20);
  const [conversionRateThreshold, setConversionRateThreshold] = useState<number>(50);
  const [minDealsThreshold, setMinDealsThreshold] = useState<number>(5);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load deals from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedDeals = localStorage.getItem('dashboard-deals');
        if (savedDeals) {
          setDeals(JSON.parse(savedDeals));
        }
      } catch (error) {
        console.error('Error loading deals from localStorage:', error);
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
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('dashboard-deals', JSON.stringify(dealsArray));
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
        
        // Save to localStorage
        if (typeof window !== 'undefined') {
          localStorage.setItem('dashboard-deals', JSON.stringify(dealsArray));
        }
        
      } else {
        throw new Error("Unsupported file format. Please upload a JSON or Excel (.xlsx/.xls) file.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
      setDeals([]);
      
      // Clear localStorage on error
      if (typeof window !== 'undefined') {
        localStorage.removeItem('dashboard-deals');
      }
    } finally {
      setIsLoading(false);
      // Reset file input
      event.target.value = '';
    }
  }, []);

  const brokerPerformance = useMemo((): BrokerPerformance[] => {
    if (!deals || deals.length === 0) return [];

    const brokerStats = deals.reduce((acc, deal) => {
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
    }).sort((a, b) => b.settledValue - a.settledValue);
  }, [deals]);

  const filteredBrokers = useMemo(() => {
    return brokerPerformance.filter(broker => broker.totalDeals >= minDealsThreshold);
  }, [brokerPerformance, minDealsThreshold]);

  const performanceSummary = useMemo(() => {
    const aboveSettledThreshold = filteredBrokers.filter(b => b.settledRate >= settledRateThreshold).length;
    const aboveConversionThreshold = filteredBrokers.filter(b => b.conversionRate >= conversionRateThreshold).length;
    const totalBrokers = filteredBrokers.length;
    
    return {
      aboveSettledThreshold,
      aboveConversionThreshold,
      totalBrokers,
      avgSettledRate: totalBrokers > 0 ? filteredBrokers.reduce((sum, b) => sum + b.settledRate, 0) / totalBrokers : 0,
      avgConversionRate: totalBrokers > 0 ? filteredBrokers.reduce((sum, b) => sum + b.conversionRate, 0) / totalBrokers : 0
    };
  }, [filteredBrokers, settledRateThreshold, conversionRateThreshold]);

  const getPerformanceStatus = (broker: BrokerPerformance) => {
    const settledMeetsThreshold = broker.settledRate >= settledRateThreshold;
    const conversionMeetsThreshold = broker.conversionRate >= conversionRateThreshold;
    
    if (settledMeetsThreshold && conversionMeetsThreshold) {
      return { status: "excellent", color: "bg-green-100 text-green-800", icon: TrendingUp };
    } else if (settledMeetsThreshold || conversionMeetsThreshold) {
      return { status: "good", color: "bg-yellow-100 text-yellow-800", icon: Target };
    } else {
      return { status: "needs-improvement", color: "bg-red-100 text-red-800", icon: AlertTriangle };
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
        
        {/* Threshold Controls */}
        <Card className="bg-white/90 border-violet/20 shadow-lg mb-6">
          <CardHeader>
            <CardTitle className="text-violet flex items-center gap-2">
              <Target className="h-5 w-5" />
              Performance Thresholds
            </CardTitle>
            <CardDescription>Set minimum performance standards to evaluate broker performance</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <Label htmlFor="settledRate">Settled Rate Threshold (%)</Label>
              <Input
                id="settledRate"
                type="number"
                value={settledRateThreshold}
                onChange={(e) => setSettledRateThreshold(Number(e.target.value))}
                className="mt-1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <Label htmlFor="conversionRate">Conversion Rate Threshold (%)</Label>
              <Input
                id="conversionRate"
                type="number"
                value={conversionRateThreshold}
                onChange={(e) => setConversionRateThreshold(Number(e.target.value))}
                className="mt-1"
                min="0"
                max="100"
              />
            </div>
            <div>
              <Label htmlFor="minDeals">Minimum Deals Required</Label>
              <Input
                id="minDeals"
                type="number"
                value={minDealsThreshold}
                onChange={(e) => setMinDealsThreshold(Number(e.target.value))}
                className="mt-1"
                min="1"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">Total Brokers</p>
                  <p className="text-2xl font-bold text-violet">{performanceSummary.totalBrokers}</p>
                </div>
                <Users className="h-8 w-8 text-violet/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">Above Settled Threshold</p>
                  <p className="text-2xl font-bold text-green-600">{performanceSummary.aboveSettledThreshold}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">Above Conversion Threshold</p>
                  <p className="text-2xl font-bold text-blue-600">{performanceSummary.aboveConversionThreshold}</p>
                </div>
                <Target className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/90 border-violet/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-violet/80">Avg Settled Rate</p>
                  <p className="text-2xl font-bold text-violet">{performanceSummary.avgSettledRate.toFixed(1)}%</p>
                </div>
                <DollarSign className="h-8 w-8 text-violet/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Broker Performance Table */}
        <Card className="bg-white/90 border-violet/20 shadow-lg">
          <CardHeader>
            <CardTitle className="text-violet">Broker Performance Details</CardTitle>
            <CardDescription>
              Detailed performance metrics for each broker (minimum {minDealsThreshold} deals required)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Broker Name</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total Deals</TableHead>
                    <TableHead className="text-right">Settled Deals</TableHead>
                    <TableHead className="text-right">Settled Rate</TableHead>
                    <TableHead className="text-right">Conversion Rate</TableHead>
                    <TableHead className="text-right">Settled Value</TableHead>
                    <TableHead className="text-right">Avg Deal Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBrokers.map((broker) => {
                    const performance = getPerformanceStatus(broker);
                    const StatusIcon = performance.icon;
                    
                    return (
                      <TableRow key={broker.brokerName} className="hover:bg-violet/5">
                        <TableCell className="font-medium">{broker.brokerName}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={performance.color}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {performance.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{broker.totalDeals}</TableCell>
                        <TableCell className="text-right">{broker.settledDeals}</TableCell>
                        <TableCell className="text-right">
                          <span className={broker.settledRate >= settledRateThreshold ? 'text-green-600 font-semibold' : 'text-red-600'}>
                            {broker.settledRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={broker.conversionRate >= conversionRateThreshold ? 'text-green-600 font-semibold' : 'text-red-600'}>
                            {broker.conversionRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(broker.settledValue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(broker.avgDealValue)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}