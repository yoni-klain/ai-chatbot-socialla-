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
import {VideoData} from "@/components/ui/youtube/types";


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
        content: `\
        Introduce yourself as Khilo, a video MVP important moments search bot.
        Ask the user about their hobbies and suggest searching for video moments related to their interests.
        Engage in a conversation to determine the specific search term key for videos.
        Try to get specific search term by suggest specific topics to exploge in numeric list format.   
        Call \`provide_video_captions_to_ai\` to retrieve video_id and timed captions in XML format.
        Analyze the video captions to find the most relevant parts based on user requirements.
        Automatically call \`show_video_moments\` to present the best moments to the user.
        Refine the search term based on user feedback and call \`provide_video_captions_to_ai\` again for updated captions.
        Adjust the video moments by updating start and end times if needed and then call \`show_video_moments\` to present the results.
        Maintain a friendly tone and provide clarifications as necessary during the conversation with the user.
        
        Feel free to customize and expand on these instructions based on your specific requirements and functionalities.`
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

          /* // Automatically trigger show_video_moments after analyzing captions
          const { show_video_moments } = getAIState().functions;
          yield show_video_moments.render({ videoInformation: videos });
 */
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
          const videoData:  VideoData[] = videoInformation.map(video => ({
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
