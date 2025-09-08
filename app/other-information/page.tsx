"use client"

import React from "react"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, ArrowRight, Calendar, Clock, User, TrendingUp, BarChart, FileText } from "lucide-react"
import Image from "next/image"

interface BlogPost {
  id: string
  title: string
  description: string
  date: string
  author: string
  readTime: string
  icon: React.ReactNode
  href: string
  tags: string[]
}

const blogPosts: BlogPost[] = [
  {
    id: "1",
    title: "Lead Sources Analysis",
    description: "Comprehensive analysis of lead generation channels, conversion rates, and ROI metrics across different marketing sources.",
    date: "2025-01-09",
    author: "Analytics Team",
    readTime: "5 min read",
    icon: <TrendingUp className="h-6 w-6" />,
    href: "/other-information/lead-sources-analysis",
    tags: ["Analytics", "Lead Generation", "ROI"]
  }
]

export default function OtherInformationPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-purple-50 to-purple-100">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-violet/10 to-pink-200/30 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-pink-200/30 to-violet/10 rounded-full blur-3xl"></div>
      </div>

      {/* Header */}
      <header className="relative z-50 p-6 flex justify-between items-center sticky top-0 bg-white/95 backdrop-blur-xl border-b border-violet/20 shadow-lg">
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="bg-white/60 border-violet/30 text-violet hover:bg-violet hover:text-white transition-all"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="text-center">
          <h1 className="text-3xl font-black bg-gradient-to-r from-purple-700 via-pink-600 to-purple-700 bg-clip-text text-transparent">
            Information Hub
          </h1>
          <p className="text-gray-600 text-sm mt-1">
            Analytics, Reports & Insights
          </p>
        </div>

        <div className="w-32"></div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-6 py-12 max-w-6xl">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Latest Reports & Analysis</h2>
          <p className="text-gray-600">Explore detailed insights and comprehensive analysis across various business dimensions</p>
        </div>

        {/* Blog Posts Grid */}
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-1 max-w-2xl mx-auto">
          {blogPosts.map((post) => (
            <Link key={post.id} href={post.href}>
              <Card className="h-full hover:shadow-xl transition-all duration-300 cursor-pointer bg-white/90 backdrop-blur border-violet/20 group hover:-translate-y-1">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-3 bg-gradient-to-br from-violet/20 to-pink-200/40 rounded-lg text-violet group-hover:scale-110 transition-transform">
                      {post.icon}
                    </div>
                    <Badge className="bg-violet/10 text-violet border-violet/20">
                      {post.tags[0]}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 group-hover:text-violet transition-colors">
                    {post.title}
                  </CardTitle>
                  <CardDescription className="mt-2 line-clamp-3">
                    {post.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {post.readTime}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex items-center gap-2">
                      <User className="h-3 w-3 text-gray-400" />
                      <span className="text-xs text-gray-600">{post.author}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-violet group-hover:translate-x-1 transition-transform" />
                  </div>
                  <div className="flex gap-2 mt-3">
                    {post.tags.slice(1).map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full">
                        {tag}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Coming Soon Section */}
        <div className="mt-12 p-8 bg-gradient-to-r from-violet/10 to-pink-200/20 rounded-2xl border border-violet/20">
          <h3 className="text-xl font-bold text-gray-800 mb-3">More Reports Coming Soon</h3>
          <p className="text-gray-600 mb-4">
            We're continuously adding new analysis and insights. Check back regularly for updates.
          </p>
          <div className="flex gap-3">
            <Badge variant="outline" className="border-violet/30 text-violet">
              Broker Performance Analysis
            </Badge>
            <Badge variant="outline" className="border-violet/30 text-violet">
              Market Trends Report
            </Badge>
            <Badge variant="outline" className="border-violet/30 text-violet">
              Customer Insights
            </Badge>
          </div>
        </div>
      </div>
    </div>
  )
}