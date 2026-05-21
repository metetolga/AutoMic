import { z } from 'zod'

const youtubeUrl = z
  .string()
  .url('Must be a valid URL.')
  .refine(
    (url) => url.includes('youtube.com') || url.includes('youtu.be'),
    'Must be a YouTube link.',
  )

const pin = z
  .string()
  .length(4, 'PIN must be exactly 4 digits.')
  .regex(/^\d+$/, 'PIN must contain only digits.')

const email = z.string().email('Enter a valid email.').max(255, 'Email is too long.')

export const AddToQueueSchema = z.object({
  name:        z.string().trim().min(2, 'Name must be at least 2 characters.').max(20, 'Name must be at most 20 characters.'),
  email,
  pin,
  youtubeLink: youtubeUrl,
})

export const ChangeSongSchema = z.object({
  email,
  pin,
  newLink: youtubeUrl,
})
