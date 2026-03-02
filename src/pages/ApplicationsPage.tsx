import { MainLayout } from '@/components/layout/MainLayout';
import { PageHeader } from '@/components/layout/PageHeader';
import { useActiveAdvertisements, useTrackAdvertisementClick } from '@/hooks/useAdvertisements';
import { Loader2, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useState, useEffect, useCallback } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useTranslation } from 'react-i18next';

export default function ApplicationsPage() {
  const { t } = useTranslation();
  const { data: ads, isLoading } = useActiveAdvertisements();
  const trackClick = useTrackAdvertisementClick();
  const isMobile = useIsMobile();
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleAdClick = (ad: { id: string; link_url: string }) => {
    trackClick.mutate(ad.id);
    window.open(ad.link_url, '_blank', 'noopener,noreferrer');
  };

  const nextSlide = useCallback(() => {
    if (ads && ads.length > 0) {
      setCurrentSlide((prev) => (prev + 1) % ads.length);
    }
  }, [ads]);

  const prevSlide = () => {
    if (ads && ads.length > 0) {
      setCurrentSlide((prev) => (prev - 1 + ads.length) % ads.length);
    }
  };

  // Auto slide
  useEffect(() => {
    if (!ads || ads.length <= 1) return;
    const interval = setInterval(nextSlide, 5000);
    return () => clearInterval(interval);
  }, [ads, nextSlide]);

  // Shell-first: no spinner

  return (
    <MainLayout>
      <PageHeader title={t('pages.applications.title')} description={t('pages.applications.description')} helpText={t('pages.applications.helpText')} />

      <div className="p-4 sm:p-6 space-y-6">
        {!ads || ads.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Chưa có ứng dụng nào được hiển thị</p>
          </div>
        ) : (
          <>
            {/* Slider Section - Featured */}
            {ads.length > 0 && (
              <div className="relative">
                <h2 className="text-lg font-semibold mb-4">Nổi bật</h2>
                <div className="relative overflow-hidden rounded-xl">
                  <div
                    className="flex transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${currentSlide * 100}%)` }}
                  >
                    {ads.map((ad) => (
                      <div key={ad.id} className="w-full flex-shrink-0">
                        <div
                          className="relative cursor-pointer group"
                          onClick={() => handleAdClick(ad)}
                        >
                          <div className="aspect-[16/9] sm:aspect-[21/9] bg-muted rounded-xl overflow-hidden">
                            {ad.image_url ? (
                              <img
                                src={ad.image_url}
                                alt={ad.title}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                                <span className="text-2xl font-bold text-primary">{ad.title}</span>
                              </div>
                            )}
                          </div>
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent rounded-xl" />
                          <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 text-white">
                            <h3 className="text-lg sm:text-xl font-bold mb-1">{ad.title}</h3>
                            {ad.description && (
                              <p className="text-sm opacity-90 line-clamp-2">{ad.description}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Navigation Buttons */}
                  {ads.length > 1 && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
                        onClick={(e) => { e.stopPropagation(); prevSlide(); }}
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full"
                        onClick={(e) => { e.stopPropagation(); nextSlide(); }}
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    </>
                  )}

                  {/* Dots indicator */}
                  {ads.length > 1 && (
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {ads.map((_, index) => (
                        <button
                          key={index}
                          className={`w-2 h-2 rounded-full transition-all ${
                            index === currentSlide ? 'bg-white w-4' : 'bg-white/50'
                          }`}
                          onClick={(e) => { e.stopPropagation(); setCurrentSlide(index); }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grid Section - All Apps */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Tất cả ứng dụng</h2>
              <div className={`grid gap-4 ${isMobile ? 'grid-cols-1' : 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'}`}>
                {ads.map((ad) => (
                  <Card
                    key={ad.id}
                    className="overflow-hidden cursor-pointer hover:shadow-lg transition-shadow group"
                    onClick={() => handleAdClick(ad)}
                  >
                    <div className="aspect-video bg-muted overflow-hidden">
                      {ad.image_url ? (
                        <img
                          src={ad.image_url}
                          alt={ad.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                          <span className="text-lg font-bold text-primary">{ad.title}</span>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{ad.title}</h3>
                          {ad.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                              {ad.description}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </MainLayout>
  );
}
