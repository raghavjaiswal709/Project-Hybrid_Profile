'use client'
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Loader2, ExternalLink, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  timestamp: string;
  category: 'market' | 'company' | 'sector' | 'economy';
  relevance: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface NewsComponentProps {
  companyCode: string;
  isMaximized: boolean;
  gradientMode: 'profit' | 'loss' | 'neutral';
}

interface GradientToggleProps {
  value: 'profit' | 'loss' | 'neutral';
  onChange: (value: 'profit' | 'loss' | 'neutral') => void;
}

const GradientToggle: React.FC<GradientToggleProps> = ({ value, onChange }) => {
  const modes = [
    { 
      key: 'loss' as const, 
      label: 'Negative', 
      icon: TrendingDown, 
      color: 'text-red-400',
      bgColor: 'bg-red-500/20 border-red-500/30'
    },
    { 
      key: 'neutral' as const, 
      label: 'Neutral', 
      icon: Minus, 
      color: 'text-zinc-400',
      bgColor: 'bg-zinc-500/20 border-zinc-500/30'
    },
    { 
      key: 'profit' as const, 
      label: 'Positive', 
      icon: TrendingUp, 
      color: 'text-green-400',
      bgColor: 'bg-green-500/20 border-green-500/30'
    },
  ];

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 mr-2">Headline Sentiment:</span>
      <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = value === mode.key;
          return (
            <button
              key={mode.key}
              onClick={() => onChange(mode.key)}
              className={`
                flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200
                ${isActive 
                  ? `${mode.bgColor} ${mode.color} shadow-sm` 
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-700/50'
                }
              `}
            >
              {mode.label}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Component for displaying current sentiment (read-only)
interface SentimentDisplayProps {
  sentiment: 'positive' | 'negative' | 'neutral';
}

const SentimentDisplay: React.FC<SentimentDisplayProps> = ({ sentiment }) => {
  const getSentimentConfig = () => {
    switch (sentiment) {
      case 'positive':
        return { label: 'Positive', color: 'text-green-400', bgColor: 'bg-green-500/20 border-green-500/30' };
      case 'negative':
        return { label: 'Negative', color: 'text-red-400', bgColor: 'bg-red-500/20 border-red-500/30' };
      case 'neutral':
      default:
        return { label: 'Neutral', color: 'text-zinc-400', bgColor: 'bg-zinc-500/20 border-zinc-500/30' };
    }
  };

  const config = getSentimentConfig();

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-400 mr-2">Headline Sentiment:</span>
      <div className={`px-3 py-1.5 rounded-md text-xs font-medium border ${config.bgColor} ${config.color}`}>
        {config.label}
      </div>
    </div>
  );
};

const NewsComponent: React.FC<NewsComponentProps> = ({ companyCode, isMaximized, gradientMode }) => {
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-zinc-950';
      case 'loss':
        return 'bg-zinc-950';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  const getSentimentStyling = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return {
          border: 'border-green-500/60 hover:border-green-400/80',
          background: 'hover:bg-green-500/10',
        };
      case 'negative':
        return {
          border: 'border-red-500/60 hover:border-red-400/80',
          background: 'hover:bg-red-500/10',
        };
      case 'neutral':
      default:
        return {
          border: 'border-zinc-600/50 hover:border-zinc-500/70',
          background: 'hover:bg-zinc-700/30',
        };
    }
  };

  const getSentimentIndicator = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return (
          <div className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3 text-green-400" />
            <span className="text-xs text-green-400 font-medium">Positive</span>
          </div>
        );
      case 'negative':
        return (
          <div className="flex items-center gap-1">
            <TrendingDown className="h-3 w-3 text-red-400" />
            <span className="text-xs text-red-400 font-medium">Negative</span>
          </div>
        );
      case 'neutral':
      default:
        return (
          <div className="flex items-center gap-1">
            <Minus className="h-3 w-3 text-zinc-400" />
            <span className="text-xs text-zinc-400 font-medium">Neutral</span>
          </div>
        );
    }
  };

  const generateRandomNews = useCallback(() => {
    const headlines = [
      `Lorem ipsum dolor sit amet consectetur adipiscing elit`,
      `Sed do eiusmod tempor incididunt ut labore et dolore magna`,
      `Ut enim ad minim veniam quis nostrud exercitation ullamco`,
      `Duis aute irure dolor in reprehenderit in voluptate velit`,
      `Excepteur sint occaecat cupidatat non proident sunt in culpa`,
      `Lorem ipsum dolor sit amet consectetur adipiscing elit sed`,
      `Tempor incididunt ut labore et dolore magna aliqua enim`,
      `Minim veniam quis nostrud exercitation ullamco laboris nisi`,
      `Aliquip ex ea commodo consequat duis aute irure dolor`,
      `Reprehenderit in voluptate velit esse cillum dolore eu fugiat`,
      `Nulla pariatur excepteur sint occaecat cupidatat non proident`,
      `Sunt in culpa qui officia deserunt mollit anim id laborum`
    ];
    
    const summaries = [
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.",
      "Dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.",
      "Sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error.",
      "Sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi.",
      "Architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
      "Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem.",
      "Ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna.",
      "Aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint.",
      "Occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis.",
      "Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo."
    ];

    const categories: NewsItem['category'][] = ['market', 'company', 'sector', 'economy'];
    const relevance: NewsItem['relevance'][] = ['high', 'medium', 'low'];
    const sentiments: NewsItem['sentiment'][] = ['positive', 'negative', 'neutral'];
    
    const news: NewsItem[] = headlines.map((headline, index) => ({
      id: `news-${index}`,
      headline,
      summary: summaries[index % summaries.length],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      relevance: relevance[Math.floor(Math.random() * relevance.length)],
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)]
    }));
    
    return news.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  useEffect(() => {
    if (companyCode) {
      setNewsItems(generateRandomNews());
    }
  }, [companyCode, generateRandomNews]);

  const handleNewsClick = (newsItem: NewsItem) => {
    const searchQuery = encodeURIComponent(`${newsItem.headline} ${companyCode}`);
    const googleSearchUrl = `https://www.google.com/search?q=${searchQuery}`;
    window.open(googleSearchUrl, '_blank', 'noopener,noreferrer');
  };

  const formatTime = (timestamp: string) => {
    const now = new Date();
    const newsTime = new Date(timestamp);
    const diffInHours = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    return `${Math.floor(diffInHours / 24)}d ago`;
  };

  const getCategoryColor = (category: NewsItem['category']) => {
    switch (category) {
      case 'market': return 'bg-blue-500/20 text-blue-400';
      case 'company': return 'bg-green-500/20 text-green-400';
      case 'sector': return 'bg-purple-500/20 text-purple-400';
      case 'economy': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-zinc-500/20 text-zinc-400';
    }
  };

  const getRelevanceIcon = (relevance: NewsItem['relevance']) => {
    switch (relevance) {
      case 'high': return <TrendingUp className="h-3 w-3 text-red-400" />;
      case 'medium': return <TrendingUp className="h-3 w-3 text-yellow-400" />;
      case 'low': return <TrendingUp className="h-3 w-3 text-zinc-400" />;
    }
  };

  if (!companyCode) {
    return (
      <Card className={`${getGradientClass(gradientMode)} shadow-lg ${isMaximized ? 'h-full' : 'h-[800px]'}`}>
        <CardHeader className="p-4 border-b border-zinc-700">
          <CardTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Market News
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="text-center text-zinc-400">
            Select a company to view relevant news
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`${getGradientClass(gradientMode)} shadow-lg ${isMaximized ? 'h-full' : 'h-auto'} border border-zinc-700/50`}>
      <CardHeader className="p-4 border-b border-zinc-700/50">
        <CardTitle className="text-base font-semibold text-white flex items-center gap-2">
          {companyCode} News Feed
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[900px]'} w-full`}>
          <div className="p-4 space-y-4">
            {newsItems.map((newsItem) => {
              const sentimentStyling = getSentimentStyling(newsItem.sentiment);
              return (
                <div
                  key={newsItem.id}
                  onClick={() => handleNewsClick(newsItem)}
                  className={`
                    group cursor-pointer p-4 rounded-lg border-2 transition-all duration-200 shadow-lg
                    ${sentimentStyling.border} ${sentimentStyling.background}
                    hover:shadow-xl
                  `}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                    </div>
                  </div>
                  <h3 className="text-white font-medium mb-2 group-hover:text-blue-400 transition-colors duration-200 flex items-start gap-2">
                    {newsItem.headline}
                    <ExternalLink className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 mt-0.5" />
                  </h3>
                  {/* <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                    {newsItem.summary}
                  </p> */}
                  <div className="mt-3 pt-3 border-t border-zinc-700/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-zinc-500">
                          Sentiment: {newsItem.sentiment}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="h-3 w-3" />
                        {formatTime(newsItem.timestamp)}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

const ACTUAL_INDICES = [
  'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'AUTONIFTY', 
  'PHARMANIFTY', 'METALNIFTY', 'ENERGYNIFTY', 'INFRA', 'GROWTHSECT', 
  'NIFTYALPHA', 'NIFTYCOMM', 'NIFTYCONS', 'NIFTYCPSE', 'NIFTYENER', 
  'NIFTYFIN', 'NIFTYFMCG', 'NIFTYHEAL', 'NIFTYIND', 'NIFTYINFRA', 
  'NIFTYIT', 'NIFTYMED', 'NIFTYMET', 'NIFTYMIC', 'NIFTYNSE', 
  'NIFTYOIL', 'NIFTYPVT', 'NIFTYPSU', 'NIFTYREAL', 'NIFTYSML', 
  'NIFTYCONS', 'NIFTYAUTO', 'NIFTYPHAR', 'NIFTYPSB', 'NIFTYPVT', 
  'NIFTY100', 'NIFTY200', 'NIFTY500', 'NIFTYMID', 'NIFTYNXT', 
  'NIFTYSML', 'NIFTYTOT', 'NIFTYDIV', 'NIFTY50', 'NIFTYQUALITY30'
];

interface ImageCarouselProps {
  companyCode: string;
  exchange: string;
  selectedDate?: Date;
  gradientMode: 'profit' | 'loss' | 'neutral';
  onGradientModeChange: (mode: 'profit' | 'loss' | 'neutral') => void;
}

interface CarouselImage {
  src: string;
  name: string;
  type: string;
  chartType: 'intraday' | 'interday';
  exists: boolean;
  dimensions?: { width: number; height: number };
}

interface ChartTabsProps {
  activeTab: 'intraday' | 'interday';
  onTabChange: (tab: 'intraday' | 'interday') => void;
  intradayCount: number;
  interdayCount: number;
}

const ChartTabs: React.FC<ChartTabsProps> = ({ activeTab, onTabChange, intradayCount, interdayCount }) => {
  const tabs = [
    { key: 'intraday' as const, label: 'Intraday', count: intradayCount },
    { key: 'interday' as const, label: 'Interday', count: interdayCount }
  ];

  return (
    <div className="flex bg-zinc-800 rounded-lg p-1 border border-zinc-700">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-all duration-200
              ${isActive 
                ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-sm' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700/50'
              }
            `}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${
              isActive ? 'bg-blue-500/30' : 'bg-zinc-600'
            }`}>
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const ImageCarousel: React.FC<ImageCarouselProps> = ({
  companyCode,
  exchange,
  selectedDate,
  gradientMode = 'neutral',
  onGradientModeChange 
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [allImages, setAllImages] = useState<CarouselImage[]>([]);
  const [isMaximized, setIsMaximized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoading, setImageLoading] = useState<Record<number, boolean>>({});
  const [activeTab, setActiveTab] = useState<'intraday' | 'interday'>('intraday');
  
  // State for maximized view headline carousel using existing news data
  const [currentHeadlineIndex, setCurrentHeadlineIndex] = useState(0);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  // Generate the same news items for headline carousel
  const generateRandomNews = useCallback(() => {
    const headlines = [
      `Lorem ipsum dolor sit amet consectetur adipiscing elit`,
      `Sed do eiusmod tempor incididunt ut labore et dolore magna`,
      `Ut enim ad minim veniam quis nostrud exercitation ullamco`,
      `Duis aute irure dolor in reprehenderit in voluptate velit`,
      `Excepteur sint occaecat cupidatat non proident sunt in culpa`,
      `Lorem ipsum dolor sit amet consectetur adipiscing elit sed`,
      `Tempor incididunt ut labore et dolore magna aliqua enim`,
      `Minim veniam quis nostrud exercitation ullamco laboris nisi`,
      `Aliquip ex ea commodo consequat duis aute irure dolor`,
      `Reprehenderit in voluptate velit esse cillum dolore eu fugiat`,
      `Nulla pariatur excepteur sint occaecat cupidatat non proident`,
      `Sunt in culpa qui officia deserunt mollit anim id laborum`
    ];
    
    const summaries = [
      "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
      "Ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat duis aute irure.",
      "Dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident.",
      "Sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis unde omnis iste natus error.",
      "Sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo inventore veritatis et quasi.",
      "Architecto beatae vitae dicta sunt explicabo nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit.",
      "Sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt neque porro quisquam est qui dolorem.",
      "Ipsum quia dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna.",
      "Aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.",
      "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint.",
      "Occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum sed ut perspiciatis.",
      "Unde omnis iste natus error sit voluptatem accusantium doloremque laudantium totam rem aperiam eaque ipsa quae ab illo."
    ];

    const categories: NewsItem['category'][] = ['market', 'company', 'sector', 'economy'];
    const relevance: NewsItem['relevance'][] = ['high', 'medium', 'low'];
    const sentiments: NewsItem['sentiment'][] = ['positive', 'negative', 'neutral'];
    
    const news: NewsItem[] = headlines.map((headline, index) => ({
      id: `news-${index}`,
      headline,
      summary: summaries[index % summaries.length],
      timestamp: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      category: categories[Math.floor(Math.random() * categories.length)],
      relevance: relevance[Math.floor(Math.random() * relevance.length)],
      sentiment: sentiments[Math.floor(Math.random() * sentiments.length)]
    }));
    
    return news.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, []);

  // Initialize news items for headline carousel
  useEffect(() => {
    if (companyCode) {
      setNewsItems(generateRandomNews());
    }
  }, [companyCode, generateRandomNews]);

  // Helper function to get sentiment styling for maximized headlines
  const getSentimentStyling = (sentiment: NewsItem['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return {
          border: 'border-green-500/60',
          background: 'bg-green-500/10',
        };
      case 'negative':
        return {
          border: 'border-red-500/60',
          background: 'bg-red-500/10',
        };
      case 'neutral':
      default:
        return {
          border: 'border-zinc-600/50',
          background: 'bg-zinc-700/30',
        };
    }
  };

  const filteredImages = useMemo(() => {
    return allImages.filter(image => image.chartType === activeTab);
  }, [allImages, activeTab]);

  const intradayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'intraday').length;
  }, [allImages]);

  const interdayCount = useMemo(() => {
    return allImages.filter(image => image.chartType === 'interday').length;
  }, [allImages]);

  const intradayImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'intraday');
  }, [allImages]);

  const interdayImages = useMemo(() => {
    return allImages.filter(image => image.chartType === 'interday');
  }, [allImages]);

  useEffect(() => {
    setCurrentIndex(0);
  }, [activeTab]);

  const getGradientClass = (mode: 'profit' | 'loss' | 'neutral') => {
    switch (mode) {
      case 'profit':
        return 'bg-gradient-to-br from-green-900/30 via-zinc-950 to-green-900/10';
      case 'loss':
        return 'bg-gradient-to-br from-red-900/30 via-zinc-950 to-red-900/10';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  // Function for maximized view background based on current headline sentiment
  const getMaximizedBackgroundClass = (sentiment: 'positive' | 'negative' | 'neutral') => {
    switch (sentiment) {
      case 'positive':
        return 'bg-gradient-to-br from-green-900 via-zinc-950 to-green-900';
      case 'negative':
        return 'bg-gradient-to-br from-red-900 via-zinc-950 to-red-900';
      case 'neutral':
      default:
        return 'bg-zinc-950';
    }
  };

  const getCurrentDateString = useCallback(() => {
    const date = selectedDate || new Date('2025-07-01');
    return date.toISOString().split('T')[0];
  }, [selectedDate]);

  // FIXED: Added the missing interday route
  const generateImagePaths = useCallback(() => {
    if (!companyCode || !exchange) return [];
    
    const dateString = getCurrentDateString();
    const companyExchange = `${companyCode}_${exchange}`;
    const imageList: CarouselImage[] = [];

    // **FIXED: Added interday image path (this was missing)**
    const pattern1Path = `/GraphsN/${dateString}/N1_Pattern_Plot/${companyExchange}/${companyExchange}_interday.png`;
    imageList.push({
      src: pattern1Path,
      name: `${companyCode} Combined Overlay`,
      type: 'N1 Pattern Analysis',
      chartType: 'interday',
      exists: false
    });

    // Existing intraday paths
    ACTUAL_INDICES.forEach(index => {
      const pattern2Path = `/GraphsN/${dateString}/watchlist_comp_ind_90d_analysis_plot/${companyExchange}_${dateString}/${companyCode}_${index}_intraday.png`;
      imageList.push({
        src: pattern2Path,
        name: `${companyCode} ${index} Analysis`,
        type: 'Confusion Heatmap',
        chartType: 'intraday',
        exists: false
      });
    });

    return imageList;
  }, [companyCode, exchange, getCurrentDateString]);

  const checkImageExists = useCallback(async (imageSrc: string): Promise<{ exists: boolean; dimensions?: { width: number; height: number } }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({
          exists: true,
          dimensions: {
            width: img.naturalWidth,
            height: img.naturalHeight
          }
        });
      };
      img.onerror = () => resolve({ exists: false });
      img.src = imageSrc;
    });
  }, []);

  useEffect(() => {
    const loadImages = async () => {
      setIsLoading(true);
      try {
        const imageList = generateImagePaths();
        const validatedImages = await Promise.all(
          imageList.map(async (image) => {
            const result = await checkImageExists(image.src);
            return {
              ...image,
              exists: result.exists,
              dimensions: result.dimensions
            };
          })
        );
        const existingImages = validatedImages.filter(img => img.exists);
        setAllImages(existingImages);
        setCurrentIndex(0);
      } catch (error) {
        console.error('Error loading images:', error);
        setAllImages([]);
      } finally {
        setIsLoading(false);
      }
    };

    if (companyCode && exchange) {
      loadImages();
    }
  }, [companyCode, exchange, generateImagePaths, checkImageExists]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % filteredImages.length);
  }, [filteredImages.length]);

  const handlePrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + filteredImages.length) % filteredImages.length);
  }, [filteredImages.length]);

  // Handlers for headline carousel in maximized view
  const handleHeadlineNext = useCallback(() => {
    setCurrentHeadlineIndex((prev) => (prev + 1) % newsItems.length);
  }, [newsItems.length]);

  const handleHeadlinePrevious = useCallback(() => {
    setCurrentHeadlineIndex((prev) => (prev - 1 + newsItems.length) % newsItems.length);
  }, [newsItems.length]);

  const handleImageLoad = (index: number) => {
    setImageLoading(prev => ({ ...prev, [index]: false }));
  };

  const handleImageLoadStart = (index: number) => {
    setImageLoading(prev => ({ ...prev, [index]: true }));
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (!companyCode || !exchange || isMaximized) return;
      
      switch (e.key) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNext();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [handleNext, handlePrevious, companyCode, exchange, isMaximized]);

  const currentImage = filteredImages[currentIndex];
  const currentHeadline = newsItems[currentHeadlineIndex];

  if (!companyCode || !exchange) {
    return null;
  }

  return (
    <div className={`flex gap-4 ${isMaximized ? 'fixed inset-4 z-50' : 'w-full'}`}>
      {/* Main Image Carousel */}
      <Card className={`shadow-lg border border-zinc-700/50 ${
        isMaximized 
          ? `${getMaximizedBackgroundClass(currentHeadline?.sentiment || 'neutral')} w-full` 
          : `${getGradientClass(gradientMode)} flex-1`
      }`}>
        <CardHeader className="flex flex-row items-center justify-between p-1 border-b border-zinc-700/50">
  {/* Left side - Title and Headline Carousel */}
  <div className="flex items-center gap-4 mx-2 flex-1">
    <CardTitle className="text-base font-semibold text-white">
      {companyCode} - Graph Analysis
    </CardTitle>
    
    {/* Headline Carousel - Only show in maximized mode */}
    {isMaximized && currentHeadline && (
      <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border-2 transition-all duration-200 ${
        getSentimentStyling(currentHeadline.sentiment).border
      } ${
        getSentimentStyling(currentHeadline.sentiment).background
      }`}>
        <Button
          variant="outline"
          size="sm"
          onClick={handleHeadlinePrevious}
          className="h-6 w-6 p-0"
          disabled={newsItems.length <= 1}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        
        <div className="max-w-md text-center px-2">
          <span className="text-white font-medium text-sm line-clamp-1">
            {currentHeadline.headline}
          </span>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleHeadlineNext}
          className="h-6 w-6 p-0"
          disabled={newsItems.length <= 1}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    )}
    
    {/* Navigation Controls - Hidden in maximized mode */}
    {filteredImages.length > 0 && !isLoading && !isMaximized && (
      <div className="flex items-center gap-1 ml-4">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          className="h-8 w-8 p-0"
          disabled={filteredImages.length <= 1}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm text-zinc-400 px-2 min-w-[60px] text-center">
          {filteredImages.length > 0 ? `${currentIndex + 1} / ${filteredImages.length}` : '0 / 0'}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          className="h-8 w-8 p-0"
          disabled={filteredImages.length <= 1}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    )}
    
    {/* Loading indicator */}
    {isLoading && (
      <div className="flex items-center gap-2 ml-4">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-zinc-400">Searching for graphs...</span>
      </div>
    )}
  </div>
  
  {/* Right side controls */}
  <div className="flex items-center gap-4">
    {/* Chart Type Tabs - Only show in non-maximized view */}
    {!isLoading && allImages.length > 0 && !isMaximized && (
      <ChartTabs 
        activeTab={activeTab} 
        onTabChange={setActiveTab}
        intradayCount={intradayCount}
        interdayCount={interdayCount}
      />
    )}
    
    {/* Gradient Mode Toggle or Sentiment Display with Pagination */}
    {isMaximized ? (
      <div className="flex items-center gap-4">
        <SentimentDisplay sentiment={currentHeadline?.sentiment || 'neutral'} />
        
        {/* Headline Counter */}
        <div className="text-sm text-zinc-400">
          {currentHeadlineIndex + 1} / {newsItems.length}
        </div>
        
        {/* Pagination dots for headlines */}
        {newsItems.length > 1 && (
          <div className="flex gap-1">
            {newsItems.map((_, index) => (
              <button
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentHeadlineIndex ? 'bg-blue-500' : 'bg-zinc-600'
                }`}
                onClick={() => setCurrentHeadlineIndex(index)}
              />
            ))}
          </div>
        )}
      </div>
    ) : (
      <GradientToggle value={gradientMode} onChange={onGradientModeChange} />
    )}
    
    {/* Maximize/Minimize button */}
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setIsMaximized(!isMaximized)}
      className="text-zinc-400 hover:text-white"
    >
      {isMaximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
    </Button>
  </div>
</CardHeader>

        
        <CardContent className="p-0 flex flex-col relative">
          {isLoading ? (
            <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-500" />
                <p className="text-zinc-400 mb-2">Searching for graphs...</p>
                <p className="text-sm text-zinc-500">
                  Looking for {companyCode} analysis images
                </p>
              </div>
            </div>
          ) : allImages.length === 0 ? (
            <div className={`${isMaximized ? 'h-[calc(100vh-200px)]' : 'h-[500px]'} flex items-center justify-center`}>
              <div className="text-center">
                <p className="text-zinc-400 mb-2">
                  No graphs found for {companyCode}
                </p>
                <p className="text-sm text-zinc-500">
                  Date: {getCurrentDateString()}
                </p>
              </div>
            </div>
          ) : (
            <>
              {isMaximized ? (
                <div className="h-[100vh] w-full mt-8">
                  {/* Headline Carousel at the top with sentiment styling */}
                  {/* <div className={`p-1 border-b border-zinc-700/50 rounded-lg border-2 transition-all duration-200 shadow-lg m-4 ${
                    currentHeadline ? getSentimentStyling(currentHeadline.sentiment).border : ''
                  } ${
                    currentHeadline ? getSentimentStyling(currentHeadline.sentiment).background : ''
                  }`}>
                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleHeadlinePrevious}
                        className="h-8 w-8 p-0"
                        disabled={newsItems.length <= 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="flex-1 text-center px-4">
                        <h2 className="text-white font-medium text-lg">
                          {currentHeadline?.headline || ''}
                        </h2>
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleHeadlineNext}
                        className="h-8 w-8 p-0"
                        disabled={newsItems.length <= 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div> */}
                  
                  {/* Side-by-side images */}
                  <div className="flex h-[100%]">
                    {/* Intraday images on the left */}
                    <div className="w-1/2 border-r border-zinc-700/50">
                      <ScrollArea className="h-full">
                        <div className="p-4 space-y-4">
                          {intradayImages.map((image, index) => (
                            <div key={index}>
                              <div className="relative overflow-hidden rounded-lg bg-zinc-900 border border-zinc-700/30">
                                {imageLoading[`intraday-${index}`] && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                  </div>
                                )}
                                <img
                                  src={image.src}
                                  alt={image.name}
                                  className="w-full h-auto block"
                                  style={{ 
                                    maxWidth: '100%',
                                    height: 'auto',
                                    display: 'block'
                                  }}
                                  onLoadStart={() => handleImageLoadStart(`intraday-${index}` as any)}
                                  onLoad={() => handleImageLoad(`intraday-${index}` as any)}
                                  onError={() => handleImageLoad(`intraday-${index}` as any)}
                                />
                              </div>
                            </div>
                          ))}
                          {intradayImages.length === 0 && (
                            <div className="text-center text-zinc-500 py-8">
                              No intraday images found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                    
                    {/* Interday images on the right */}
                    <div className="w-1/2">
                      <ScrollArea className="h-full">
                        <div className="p-4">
                          {interdayImages.map((image, index) => (
                            <div key={index}>
                              <div className="relative overflow-hidden rounded-lg bg-zinc-900 border border-zinc-700/30">
                                {imageLoading[`interday-${index}`] && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                                    <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                  </div>
                                )}
                                <img
                                  src={image.src}
                                  alt={image.name}
                                  className="w-full h-auto block"
                                  style={{ 
                                    maxWidth: '100%',
                                    height: '120%',
                                    display: 'block'
                                  }}
                                  onLoadStart={() => handleImageLoadStart(`interday-${index}` as any)}
                                  onLoad={() => handleImageLoad(`interday-${index}` as any)}
                                  onError={() => handleImageLoad(`interday-${index}` as any)}
                                />
                              </div>
                            </div>
                          ))}
                          {interdayImages.length === 0 && (
                            <div className="text-center text-zinc-500 py-8">
                              No interday images found
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </div>
                  </div>
                </div>
              ) : (
                // Non-maximized view remains the same
                <>
                  <div className="border-b border-zinc-700/50 bg-zinc-700/20">
                    <div className="flex items-center gap-2 mt-1">
                    </div>
                  </div>
                  
                  <div className={`relative overflow-hidden bg-gradient-to-br ${
                    gradientMode === 'profit' ? 'from-green-950/20 to-zinc-900' :
                    gradientMode === 'loss' ? 'from-red-950/20 to-zinc-900' : 
                    'from-zinc-900 to-zinc-900'
                  } min-h-[400px]`}>
                    {imageLoading[currentIndex] && (
                      <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/50 z-10">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      </div>
                    )}
                    {currentImage && (
                      <img
                        src={currentImage.src}
                        alt={currentImage.name}
                        className="w-full h-auto block"
                        style={{ 
                          maxWidth: '100%',
                          height: 'auto',
                          display: 'block'
                        }}
                        onLoadStart={() => handleImageLoadStart(currentIndex)}
                        onLoad={() => handleImageLoad(currentIndex)}
                        onError={() => handleImageLoad(currentIndex)}
                      />
                    )}
                  </div>
                  
                  {filteredImages.length > 1 && (
                    <div className="p-2 border-t border-zinc-700/50 bg-zinc-700/20">
                      <div className="flex justify-center gap-1">
                        {filteredImages.map((_, index) => (
                          <button
                            key={index}
                            className={`w-2 h-2 rounded-full transition-colors ${
                              index === currentIndex ? 'bg-blue-500' : 'bg-zinc-600'
                            }`}
                            onClick={() => setCurrentIndex(index)}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* News Component - Only show in non-maximized view */}
      {!isMaximized && (
        <div className="w-[360px] flex-shrink-0">
          <NewsComponent 
            companyCode={companyCode} 
            isMaximized={isMaximized} 
            gradientMode={gradientMode}
          />
        </div>
      )}
    </div>
  );
};
