'use client'
import * as React from "react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SelectInterval } from "./controllers/SelectInterval";
import { SelectIndicators } from "./controllers/SelectIndicators";
import { CalendarForm } from "./controllers/CalendarForm";
import { WatchlistSelector } from "./controllers/WatchlistSelector";
import { ImageCarousel } from "./ImageCarousel";
import { BarChart3 } from "lucide-react";
interface CardWithFormProps {
  onCompanyChange: (companyCode: string | null, exchange?: string) => void;
  onDateRangeChange: (startDate: Date | undefined, endDate: Date | undefined) => void;
  onFetchData: () => void;
  onIntervalChange: (interval: string) => void;
  onIndicatorsChange: (indicators: string[]) => void;
  selectedWatchlist?: string;
  onWatchlistChange?: (watchlist: string) => void;
  loading?: boolean;
}
export function CardWithForm({
  onCompanyChange,
  onDateRangeChange,
  onFetchData,
  onIntervalChange,
  onIndicatorsChange,
  selectedWatchlist,
  onWatchlistChange,
  loading = false,
}: CardWithFormProps) {
  const [selectedCompany, setSelectedCompany] = React.useState<{
    companyCode: string;
    exchange: string;
  } | null>(null);
  const [isCarouselOpen, setIsCarouselOpen] = React.useState(false);
  const handleDateRangeChange = React.useCallback((startDate: Date | undefined, endDate: Date | undefined) => {
    console.log('CardWithForm received date range change:', startDate, endDate);
    onDateRangeChange(startDate, endDate);
  }, [onDateRangeChange]);
  const handleCompanySelect = React.useCallback((companyCode: string | null, exchange?: string) => {
    console.log('CardWithForm received company change:', companyCode, 'on exchange:', exchange);
    if (companyCode && exchange) {
      setSelectedCompany({ companyCode, exchange });
    } else {
      setSelectedCompany(null);
    }
    onCompanyChange(companyCode, exchange);
  }, [onCompanyChange]);
  const handleFetchData = React.useCallback(() => {
    console.log('CardWithForm received fetch data request');
    onFetchData();
  }, [onFetchData]);
  const handleIntervalChange = React.useCallback((interval: string) => {
    console.log('CardWithForm received interval change:', interval);
    onIntervalChange(interval);
  }, [onIntervalChange]);
  const handleIndicatorsChange = React.useCallback((indicators: string[]) => {
    console.log('CardWithForm received indicators change:', indicators);
    onIndicatorsChange(indicators);
  }, [onIndicatorsChange]);
  const handleWatchlistChange = React.useCallback((watchlist: string) => {
    console.log('CardWithForm received watchlist change:', watchlist);
    setSelectedCompany(null);
    if (onWatchlistChange) {
      onWatchlistChange(watchlist);
    }
  }, [onWatchlistChange]);
  const handleOpenCarousel = React.useCallback(() => {
    if (selectedCompany) {
      setIsCarouselOpen(true);
    }
  }, [selectedCompany]);
  return (
    <>
      <Card className="border-none w-full">
        <CardContent className="p-4 w-full">
          <div className="space-y-2">
            {}
            <div className="flex justify-between gap-4">
              <div className="p-3 border border-opacity-30 rounded-md flex-1 gap-4 h-24 flex items-center">
                <WatchlistSelector 
                  onCompanySelect={handleCompanySelect}  
                  selectedWatchlist={selectedWatchlist}
                  onWatchlistChange={handleWatchlistChange} 
                />
                 {}
              <div className=" flex items-center justify-center min-w-[120px]">
                <Button
                  onClick={handleOpenCarousel}
                  disabled={!selectedCompany}
                  variant="outline"
                  className="flex items-center gap-2 h-20"
                >
                  {}
                  <span className="text-sm">View Graphs</span>
                </Button>
              </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      {}
      {selectedCompany && (
        <ImageCarousel
          isOpen={isCarouselOpen}
          onClose={() => setIsCarouselOpen(false)}
          companyCode={selectedCompany.companyCode}
          exchange={selectedCompany.exchange}
        />
      )}
    </>
  );
}
export default CardWithForm;

