import { clsx } from "clsx";

const VIDEOS = [
  {
    id: "ggK2dKLfaz8",
    label: "Quick start",
    length: "1-minute recap",
    description: "A faster version for a quick refresher on how to play poker.",
    vertical: true,
  },
  {
    id: "eCALK64hVt4",
    label: "Full explanation",
    length: "3.5 minutes",
    description: "The same material with more detail, for a complete walkthrough.",
    vertical: false,
  },
] as const;

/** Two embedded YouTube videos on how to play poker: a quick recap and a full explanation. */
export function LearningVideos({ headingTag: Heading = "h2" }: { headingTag?: "h2" | "h3" }) {
  return (
    <section aria-labelledby="learn-heading" className="flex flex-col gap-3">
      <Heading id="learn-heading" className="label">
        How to play poker
      </Heading>
      <div className="mt-2 grid gap-4 sm:grid-cols-2">
        {VIDEOS.map((video) => (
          <figure key={video.id} className="flex flex-col gap-2">
            <div
              className={clsx(
                "w-full overflow-hidden rounded-[12px] border border-line bg-surface",
                video.vertical ? "mx-auto aspect-[9/16] max-w-[240px]" : "aspect-video",
              )}
            >
              <iframe
                className="size-full"
                src={`https://www.youtube-nocookie.com/embed/${video.id}`}
                title={`${video.label}: ${video.length}, how to play poker`}
                loading="lazy"
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>
            <figcaption className="text-sm">
              <span className="font-[450]">
                {video.label}: {video.length}
              </span>
              <span className="block text-xs text-muted">{video.description}</span>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
