import { UseChatHelpers } from 'ai/react'

import { Button } from '@/components/ui/button'
import { ExternalLink } from '@/components/external-link'
import { IconArrowRight } from '@/components/ui/icons'

const exampleMessages = [
  {
    heading: 'Explain technical concepts',
    message: `What is a "serverless function"?`
  },
  {
    heading: 'Summarize an article',
    message: 'Summarize the following article for a 2nd grader: \n'
  },
  {
    heading: 'Draft an email',
    message: `Draft an email to my boss about the following: \n`
  }
]

export function EmptyScreen({ setInput }: Pick<UseChatHelpers, 'setInput'>) {
  return (
    <div className="mx-auto max-w-2xl px-4">
      <div className="flex flex-col gap-2 rounded-lg border bg-background p-8">
        <h1 className="text-lg font-semibold">
          Welcome to video moment search AI Chatbot!
        </h1>
        <p className="leading-normal text-muted-foreground">
          This is an smart AI chatbot app can save a lot of time{' '}
          <ExternalLink href="https://socialla.org">socialla.com</ExternalLink>, the{' '}
          <ExternalLink href="https://socialla.org">
            socialla projects
          </ExternalLink>
          , and{' '}
          <ExternalLink href="https://www.linkedin.com/in/khilo-jammal-01252036/">
            Created by.
          </ExternalLink>
          .
        </p>
        <p className="leading-normal text-muted-foreground">
          It uses{' AI '}
          <ExternalLink href="https://socialla.org">
            Smart search base on video content
          </ExternalLink>{' '}
          we can safe a lot of your time by picking up a most fitable video content based on your needs.
          </p>
      </div>
    </div>
  )
}
