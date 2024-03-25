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
import { loadVideosWithCaptions } from '../api/loadVideosWithCaptions';
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
import VideoPlayer from "@/components/ui/youtube/video-player";


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
    model: 'gpt-4-turbo-preview',
    provider: openai,
    initial: <SpinnerMessage />,
    messages: [
      {
        role: 'system',
        content: `\
You are Khilo.         
You are a video MVP important moments search conversation bot and you can help users to find most important moments withing the video.
You ask user about user hobbies and suggest user to search for some video moments.
You have to lead a small talk with the user and understand a best search term key for videos search. 
You need to be as specific as possible in the search key, ask more questions to make the search term specific. 
You need to call \`provide_video_captions_to_ai\` to get back video_id and timed captions in xml format.
You need to analize the video captions to find most important to user requirments parts and to call \`show_video_moments\` to present results to user  
You can call \`provide_video_captions_to_ai\` to get back video_id and timed captions in xml format as many as you have a new search term.
You can refine search term based on user refinment and call again \`provide_video_captions_to_ai\` to get video_id and timed captions in xml format.
You need to call automaticaly function \`show_video_moments\` to show best moments to user.  
You can adjust better video moments by updating start endtime and call \`show_video_moments\` to present results to user. 
Besides that, you can also chat with users in friendly manner and do some clarifications if needed.`
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
        description: 'API to get 5 videos with captions for futher analysis based on captions',
        parameters: z.object({
          searchKey: z
            .string()
            .describe(
              'The search term to search a video on youtube'
            )
        }),
        render: async function* ({ searchKey }) {
          yield (
            <BotCard>
              <div>`I am presenting videos`{ searchKey }</div>
            </BotCard>
          )
          
          
          await sleep(1000)
          
          const videos = await loadVideosWithCaptions(searchKey);
          
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
              <div>
                Video moments comming soon..... 
              </div>
            </BotCard>
          )
        }
      },
      show_video_moments: {
        description: `Get list of video information including thumbnails url value and the start and end seconds of the best moments according to the user question at least 10 seconds length . 
                      Limit to 5 best. 
                      Use this to show the  start and the end of the best moments to the user.`,
        parameters: z.object({
          videoInformation: z.array(z.object({
            videoId: z.string(),
            videoTitle: z.string(),
            bestMomentStart:z.number(),
            bestMomentEnd:z.number(),
            thumbnails: z.object({
                default: z.object({
                    url: z.string()
                })
                })
          }))
        }),
        render: async function* ({ videoInformation }) {
          const videoData = videoInformation.map(video => ({
            start: video.bestMomentStart,
            end: video.bestMomentEnd,
            title: video.videoTitle,
            thumbnailUrl: video.thumbnails.default.url,
            videoId: video.videoId
          }));

          yield (
            <BotCard>
              <div>
                just before presenting results
              </div>
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
