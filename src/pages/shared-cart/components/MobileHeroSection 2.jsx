import React from 'react';
import Icon from '@/components/AppIcon';
import Image from '../../../components/AppImage';

export default function MobileHeroSection({ restaurant }) {
  if (!restaurant) return null;

  const name = restaurant?.name || '';
  const cuisine = restaurant?.cuisine_type || restaurant?.cuisine || null;
  const rating =
    typeof restaurant?.rating === 'number' ? restaurant.rating.toFixed(1) : restaurant?.rating;
  const distance =
    restaurant?.distanceMiles ??
    restaurant?.distance_miles ??
    restaurant?.distance ??
    null;

  const fmt1 = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(1) : '';
  };

  return (
    <section className="md:hidden">
      {/* Main image (same look as desktop, just shorter) */}
      <div className="relative h-40 overflow-hidden">
        <Image
          src={restaurant?.image}
          alt={name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      </div>

      {/* Title + meta below image */}
      <div className="px-4 py-3">
        <h1 className="text-lg font-semibold leading-snug line-clamp-2 text-foreground">
          {name}
        </h1>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          {cuisine ? <span className="whitespace-nowrap">{cuisine}</span> : null}

          {rating ? (
            <>
              <span className="opacity-40">•</span>
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Icon name="Star" size={12} />
                {rating}
              </span>
            </>
          ) : null}

          {distance ? (
            <>
              <span className="opacity-40">•</span>
              <span className="whitespace-nowrap">{fmt1(distance)} mi</span>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
