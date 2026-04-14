import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Link2 } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialLat?: number;
  initialLng?: number;
  onConfirm: (lat: number, lng: number) => void;
}

function ClickHandler({ onClick }: { onClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export function LocationMapPicker({ open, onOpenChange, initialLat, initialLng, onConfirm }: Props) {
  const [pos, setPos] = useState<[number, number]>([initialLat || 10.762622, initialLng || 106.660172]);
  const [gmapsLink, setGmapsLink] = useState('');
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      const lat = initialLat || 10.762622;
      const lng = initialLng || 106.660172;
      setPos([lat, lng]);
      setGmapsLink('');
    }
  }, [open, initialLat, initialLng]);

  // Fly to new position when it changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.flyTo(pos, mapRef.current.getZoom(), { duration: 0.5 });
    }
  }, [pos]);

  const parseGoogleMapsLink = () => {
    const link = gmapsLink.trim();
    if (!link) return;

    // Try various Google Maps URL formats
    const patterns = [
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,           // @lat,lng
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,        // !3dlat!4dlng
      /q=(-?\d+\.\d+),(-?\d+\.\d+)/,           // q=lat,lng
      /ll=(-?\d+\.\d+),(-?\d+\.\d+)/,          // ll=lat,lng
      /place\/.*\/@(-?\d+\.\d+),(-?\d+\.\d+)/, // place/@lat,lng
      /(-?\d+\.\d{4,}),\s*(-?\d+\.\d{4,})/,    // generic lat,lng with 4+ decimals
    ];

    for (const pattern of patterns) {
      const match = link.match(pattern);
      if (match) {
        const lat = parseFloat(match[1]);
        const lng = parseFloat(match[2]);
        if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
          setPos([lat, lng]);
          toast.success(`Đã lấy tọa độ: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
          return;
        }
      }
    }
    toast.error('Không nhận diện được tọa độ từ link. Thử copy link đầy đủ từ Google Maps.');
  };

  const handleConfirm = () => {
    onConfirm(pos[0], pos[1]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-base">Chọn vị trí trên bản đồ</DialogTitle>
        </DialogHeader>

        <div className="px-4 space-y-2">
          <div>
            <Label className="text-xs">Dán link Google Maps</Label>
            <div className="flex gap-2">
              <Input
                value={gmapsLink}
                onChange={e => setGmapsLink(e.target.value)}
                placeholder="https://maps.google.com/..."
                className="flex-1 text-xs"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); parseGoogleMapsLink(); } }}
              />
              <Button variant="outline" size="sm" onClick={parseGoogleMapsLink}>
                <Link2 className="h-3.5 w-3.5 mr-1" /> Lấy
              </Button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Hoặc nhấn vào bản đồ để chọn vị trí
          </p>
        </div>

        <div className="h-[300px] w-full">
          <MapContainer
            ref={mapRef}
            center={pos}
            zoom={15}
            className="h-full w-full"
            style={{ zIndex: 0 }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={pos} />
            <ClickHandler onClick={(lat, lng) => setPos([lat, lng])} />
          </MapContainer>
        </div>

        <div className="px-4 pb-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {pos[0].toFixed(6)}, {pos[1].toFixed(6)}
          </p>
        </div>

        <DialogFooter className="px-4 pb-4">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Hủy</Button>
          <Button size="sm" onClick={handleConfirm}>Xác nhận vị trí</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
