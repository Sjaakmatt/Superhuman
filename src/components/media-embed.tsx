import type { MediaLink } from "@/lib/meditation";

function youtubeId(url: string): string | null {
  const m = /(?:v=|youtu\.be\/|embed\/)([\w-]{11})/.exec(url);
  return m ? m[1] : null;
}

/** Gedeelde media-embed: geleide audio, YouTube-video of externe link. */
export function MediaEmbed({ media }: { media: MediaLink }) {
  if (media.provider === "youtube") {
    const id = youtubeId(media.url);
    if (id) {
      return (
        <div className="overflow-hidden rounded-2xl border border-line bg-black">
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://www.youtube.com/embed/${id}`}
              title={media.title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="absolute inset-0 size-full"
            />
          </div>
        </div>
      );
    }
  }
  if (media.provider === "audio") {
    return (
      <div className="rounded-2xl border border-line bg-card p-4">
        <p className="mb-2 text-xs text-muted">{media.title}</p>
        <audio controls src={media.url} className="w-full">
          <track kind="captions" />
        </audio>
      </div>
    );
  }
  return (
    <a
      href={media.url}
      target="_blank"
      rel="noreferrer"
      className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 transition-colors hover:border-muted"
    >
      <span className="min-w-0 flex-1 text-sm">{media.title}</span>
      <span aria-hidden className="text-muted">
        ↗
      </span>
    </a>
  );
}
