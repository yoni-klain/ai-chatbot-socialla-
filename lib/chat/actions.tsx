import 'server-only'

import {
  createAI,
  createStreamableUI,
  getMutableAIState,
  getAIState,
  render,
  createStreamableValue
} from 'ai/rsc'
import OpenAI from 'openai'

import {
  spinner,
  BotCard,
  BotMessage,
  SystemMessage
} from '@/components/stocks'

import { z } from 'zod'

import { Events } from '@/components/stocks/event'
import { Stocks } from '@/components/stocks/stocks'
import { loadVideosWithCaptions } from '../api/loadVideosWithCaptions'
import { Videos } from '@/components/videos/videos'
import {
  formatNumber,
  runAsyncFnWithoutBlocking,
  sleep,
  nanoid
} from '@/lib/utils'
import { saveChat } from '@/app/actions'
import { SpinnerMessage, UserMessage } from '@/components/stocks/message'
import { Chat } from '@/lib/types'
import { auth } from '@/auth'
import VideoPlayer from '@/components/ui/youtube/video-player'
import { VideoData } from '@/components/ui/youtube/types'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || ''
})

async function submitUserMessage(content: string) {
  'use server'

  const aiState = getMutableAIState<typeof AI>()

  aiState.update({
    ...aiState.get(),
    messages: [
      ...aiState.get().messages,
      {
        id: nanoid(),
        role: 'user',
        content
      }
    ]
  })

  

  let textStream: undefined | ReturnType<typeof createStreamableValue<string>>
  let textNode: undefined | React.ReactNode

  const ui = render({
    model: 'gpt-3.5-turbo',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `
        Hello, I'm Khilo, your video MVP search assistant. I can help you find important moments in videos based on your interests. 
        Tell me about your hobbies, and let's find some engaging video moments together.
        Could you specify a topic or an event that interests you? Once I have that, I'll fetch some video captions and analyze them to find key moments that you'll find fascinating.
        I will provide following question and suggest 10 more detailed search term options to retrive the best match search term. 
        
        Provide option in a new line and inside brackets [].
        // Example 
        Mike Tyson
        I can find many topics about Mike Tyson, like:\n
        [Best Myke Tyson knokouts] \n
        [best Mike Tyson talk]. \n
        
        Let's get started by discussing what you're interested in!
      `
      },
      ...aiState.get().messages.map((message: any) => ({
        role: message.role,
        content: message.content,
        name: message.name
      }))
    ],
    text: ({ content, done, delta }) => {
      if (!textStream) {
        textStream = createStreamableValue('')
        textNode = <BotMessage content={textStream.value} />
      }

      if (done) {
        textStream.done()
        aiState.done({
          ...aiState.get(),
          messages: [
            ...aiState.get().messages,
            {
              id: nanoid(),
              role: 'assistant',
              content
            }
          ]
        })
      } else {
        textStream.update(delta)
      }

      return textNode
    },
    functions: {
      provide_video_captions_to_ai: {
        description:
          'Retrieves video data including captions for a specified search term. This API is optimized to fetch a limited set of videos (up to 5) to ensure focused analysis on highly relevant content. The retrieved captions are intended for subsequent processing to identify key moments that are most significant to the user’s interests.',
        parameters: z.object({
          searchKey: z
            .string()
            .describe('The YouTube search term used to find relevant videos.')
        }),
        render: async function* ({ searchKey }) {
          yield (
            <BotCard>
              <div>`I am presenting videos`{searchKey}</div>
            </BotCard>
          )

          await sleep(1000)

          const videos = await loadVideosWithCaptions(searchKey)

          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'provide_video_captions_to_ai',
                content: JSON.stringify(videos)
              }
            ]
          })

          return (
            <BotCard>
              <div>Video moments comming soon.....</div>
            </BotCard>
          )
        }
      },
      show_video_moments: {
        description: `Presents the most relevant video segments as determined by AI analysis. This function displays up to five of the best moments, each annotated with start and end timestamps to guide the user directly to the highlights. Thumbs are provided to give a visual preview of each moment.`,
        parameters: z.object({
          videoInformation: z.array(
            z.object({
              videoId: z.string(),
              videoTitle: z.string(),
              bestMomentStart: z.number(),
              bestMomentEnd: z.number(),
              thumbnails: z.object({
                default: z.object({
                  url: z.string()
                })
              })
            })
          )
        }),
        render: async function* ({ videoInformation }) {
          const videoData: VideoData[] = videoInformation.map(video => ({
            start: video.bestMomentStart,
            end: video.bestMomentEnd,
            title: video.videoTitle,
            thumbnailUrl: video.thumbnails.default.url,
            videoId: video.videoId
          }))

          yield (
            <BotCard>
              <div>just before presenting results</div>
            </BotCard>
          )

          await sleep(1000)
          
          aiState.done({
            ...aiState.get(),
            messages: [
              ...aiState.get().messages,
              {
                id: nanoid(),
                role: 'function',
                name: 'videos_best_matches',
                content: JSON.stringify(videoData)
              }
            ]
          })

          return (
            <BotCard>
              <div>
                <VideoPlayer videoData={videoData} />
              </div>
            </BotCard>
          )
        }
      }
    }
  })

  return {
    id: nanoid(),
    display: ui
  }
}

export type Message = {
  role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
  content: string
  id?: string
  name?: string
}

export type AIState = {
  chatId: string
  messages: {
    role: 'user' | 'assistant' | 'system' | 'function' | 'data' | 'tool'
    content: string
    id: string
    name?: string
  }[]
}

export type UIState = {
  id: string
  display: React.ReactNode
}[]

export const AI = createAI<AIState, UIState>({
  actions: {
    submitUserMessage
  },
  initialUIState: [],
  initialAIState: { chatId: nanoid(), messages: [] },
  unstable_onGetUIState: async () => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const aiState = getAIState()

      if (aiState) {
        const uiState = getUIStateFromAIState(aiState)
        return uiState
      }
    } else {
      return
    }
  },
  unstable_onSetAIState: async ({ state }) => {
    'use server'

    const session = await auth()

    if (session && session.user) {
      const { chatId, messages } = state

      const createdAt = new Date()
      const userId = session.user.id as string
      const path = `/chat/${chatId}`
      const title = messages[0].content.substring(0, 100)

      const chat: Chat = {
        id: chatId,
        title,
        userId,
        createdAt,
        messages,
        path
      }

      await saveChat(chat)
    } else {
      return
    }
  }
})

export const getUIStateFromAIState = (aiState: Chat) => {
  return aiState.messages
    .filter(message => message.role !== 'system')
    .map((message, index) => ({
      id: `${aiState.chatId}-${index}`,
      display:
        message.role === 'function' ? (
          message.name === 'listStocks' ? (
            <BotCard>
              <Stocks props={JSON.parse(message.content)} />
            </BotCard>
          ) : message.name === 'showStockPrice' ? (
            <BotCard>
              <div>log1</div>
            </BotCard>
          ) : message.name === 'showStockPurchase' ? (
            <BotCard>
              <div>log1</div>
            </BotCard>
          ) : message.name === 'getEvents' ? (
            <BotCard>
              <Events props={JSON.parse(message.content)} />
            </BotCard>
          ) : null
        ) : message.role === 'user' ? (
          <UserMessage>{message.content}</UserMessage>
        ) : (
          <BotMessage content={message.content} />
        )
    }))
}
