"use client"
import React from 'react';

type OptionButtonProps = {
  option: string;
  onSubmit: (option: string) => void;
}

const Options = (props: OptionButtonProps) => {
  return (
    <div>
      {/* Correct the onClick handler to call onSubmit with the option */}
      <button onClick={() => props.onSubmit(props.option)}>{props.option}</button>
    </div>
  )
}

export default Options;