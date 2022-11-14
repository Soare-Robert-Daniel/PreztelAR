import { Component } from "solid-js";

const Select: Component<{
    label: string
    options: { label: string, value: string }[]
    value: string
    onChange: (value: string) => void
}> = (props) => {
    return <div class="mb-4">
        <label for="countries" class="block mb-2 text-sm font-medium text-gray-900 dark:text-gray-400">{props.label}</label>
        <select id="countries" class="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
            onchange={e => {
                props.onChange((e.target as HTMLSelectElement).value)
            }}
            value={props.value}
        >
            {
                props.options?.map(
                    opt => (<option value={opt.value}>{opt.label}</option>)
                )
            }
        </select>
    </div>
}

export default Select;