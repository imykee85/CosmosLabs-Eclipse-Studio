const initials = (name: string) => name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Round avatar: the user's photo when they have one, otherwise their initials.
export default function Avatar({ name, image, className }: { name: string; image?: string; className?: string }) {
  return (
    <span className={className} style={image ? { overflow: "hidden", padding: 0 } : undefined}>
      {image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
