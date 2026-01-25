import { Play } from "lucide-react";
import { useState } from "react";

interface Video {
  id: string;
  thumbnail: string;
  videoUrl: string;
  title?: string;
}

interface VideoGalleryProps {
  videos?: Video[];
}

const defaultVideos: Video[] = [
  {
    id: "1",
    thumbnail: "https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=400&h=600&fit=crop",
    videoUrl: "",
    title: "Unboxing del producto",
  },
  {
    id: "2",
    thumbnail: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&h=600&fit=crop",
    videoUrl: "",
    title: "Review completa",
  },
  {
    id: "3",
    thumbnail: "https://images.unsplash.com/photo-1572569511254-d8f925fe2cbb?w=400&h=600&fit=crop",
    videoUrl: "",
    title: "Demostración en uso",
  },
];

export const VideoGallery = ({ videos = defaultVideos }: VideoGalleryProps) => {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  if (videos.length === 0) return null;

  return (
    <section className="py-16 lg:py-24 bg-background">
      <div className="container">
        <div className="text-center mb-12">
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold text-foreground mb-4">
            Mira el producto en acción
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Videos reales de clientes y demostraciones del producto
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 lg:gap-6 max-w-4xl mx-auto">
          {videos.map((video) => (
            <div
              key={video.id}
              className="group relative aspect-[9/16] rounded-2xl overflow-hidden shadow-card cursor-pointer hover:shadow-lg transition-all duration-300"
              onClick={() => setActiveVideo(video.id)}
            >
              <img
                src={video.thumbnail}
                alt={video.title || "Video del producto"}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-transparent to-transparent" />
              
              {/* Play button */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                  <Play className="w-6 h-6 text-primary-foreground ml-1" />
                </div>
              </div>

              {/* Title */}
              {video.title && (
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <p className="text-primary-foreground text-sm font-medium">
                    {video.title}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Video Modal */}
      {activeVideo && (
        <div
          className="fixed inset-0 z-50 bg-foreground/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveVideo(null)}
        >
          <div className="relative w-full max-w-lg aspect-[9/16] rounded-2xl overflow-hidden bg-card">
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              Video en modo demo
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
