import classNames from "classnames";
import { ParentComponent } from "solid-js";

const Button: ParentComponent<{ onClick: () => void, variant?: 'normal' | 'error' }> = (props) => {
    return <button class={
        classNames(
            "relative inline-flex items-center justify-center p-0.5 mb-2 mr-2 overflow-hidden text-md font-medium bg-gradient-to-br text-gray-900 rounded-lg group  hover:text-white dark:text-white focus:ring-4 focus:outline-none focus:ring-pink-200 dark:focus:ring-pink-800",
            { 'from-purple-600 to-blue-500 group-hover:from-purple-600 group-hover:to-blue-500': props.variant === undefined || props.variant === 'normal' },
            {'from-red-200 via-red-300 to-yellow-200 group-hover:from-red-200 group-hover:via-red-300': props.variant === 'error'}
        )
    }
        onClick={props.onClick}
    >
        <span class="relative px-5 py-2.5 transition-all ease-in duration-75 bg-white dark:bg-gray-900 rounded-md group-hover:bg-opacity-0">
            {props.children}
        </span>
    </button>
}

export default Button;