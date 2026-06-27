import type { ChatMessage } from './types'

export const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'გამარჯობა! აღწერე ოთახი ან ბინა — სტილი, ფერები, ავეჯი. დაგეხმარები moodboard-ის შექმნაში და სტუდიოში გადატანაში.',
  quickReplies: ['მცირე საძინებელი', 'მისაღები ოთახი', 'სამუშაო კუთხე'],
}
