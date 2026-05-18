export async function getYoutubeTitle(url: string) {
  const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`

  const res = await fetch(endpoint)

  if (!res.ok) {
    throw new Error("Invalid YouTube URL")
  }

  const data = await res.json()

  return data.title as string
}