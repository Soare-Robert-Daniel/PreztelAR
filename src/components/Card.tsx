import { ParentComponent } from "solid-js";

const Card: ParentComponent = (props) => {
    return (
        <div class="m-2 p-6 bg-white rounded-lg border border-gray-200 shadow-md dark:bg-gray-800 dark:border-gray-700">
            {props.children}
        </div>
    )
}

export default Card;