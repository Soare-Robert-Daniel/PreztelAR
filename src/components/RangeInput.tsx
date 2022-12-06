import { Component } from "solid-js";

const RangeInput: Component<{
    id: string
    label: string
    value: number
    help?: string
    max?: number
    min?: number
    step?: number
    onChange: (value: number) => void
}> = (props) => {

    return <div class="mb-6">
        <label for={props.id} class="block mb-1 text-lg font-mono font-medium text-gray-900 dark:text-gray-300">{`${props.label}: ${props.value}`}</label>
        <input
            class="w-full h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
            type="range" id={props.id} name={props.id}
            min={props.min ?? 0} max={props.max ?? 100} step={props.step ?? 1}
            onchange={e => {
                props.onChange(parseFloat((e.target as HTMLSelectElement).value))
            }}
            value={props.value}
        />
        <p
            class="block text-sm font-mono font-medium text-gray-700 dark:text-gray-200"
        >{props.help}</p>
    </div>
}

export default RangeInput;