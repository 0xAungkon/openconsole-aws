import { useState } from 'react'
import { useSessionStore } from '../store/sessionStore'

export function EndpointDialog({ onClose }: { onClose: () => void }) {
  const { endpointUrl, setEndpointUrl } = useSessionStore()
  const [value, setValue] = useState(endpointUrl)

  function save() {
    setEndpointUrl(value.trim())
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white p-5 shadow-xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          <span className="inline-block h-4 w-[3px] rounded-full bg-brand-500" />
          Endpoint override
        </h3>
        <p className="mt-2 text-xs text-gray-500">
          Point requests at a local Floci / LocalStack endpoint. Leave blank to
          use the default AWS endpoint for the selected region.
        </p>
        <label className="mt-3 flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-200">
            Endpoint URL
          </span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list="endpoint-suggestions"
            placeholder="http://localhost:4566"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none dark:border-gray-700 dark:bg-gray-950"
          />
          <datalist id="endpoint-suggestions">
            <option value="http://localhost:4566" />
          </datalist>
        </label>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-600"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
