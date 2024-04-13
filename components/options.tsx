"use client"
import React from 'react';
import { useAIState } from 'ai/rsc'

type OptionButtonProps = {
  option: string;
  onSubmit: (option: string) => void;
}

const Options = (props: OptionButtonProps) => {
  return (
    <div className="text-left my-4" >
      {/* Correct the onClick handler to call onSubmit with the option */}
      <button className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline" type='button' onClick={() => props.onSubmit(props.option)}>{props.option}</button>
    </div>
  )
}

export default Options;