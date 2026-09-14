import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { generateCodename } from '../lib/codename'

/** Text input prefilled with a friendly codename, with a "generate another" button. */
export function CodenameInput({ id, value, required, placeholder, onChange }: {
  id: string
  value: string
  required?: boolean
  placeholder?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        id={id}
        value={value}
        required={required}
        placeholder={placeholder ?? 'auto-generated'}
        onChange={(e) => onChange(e.target.value)}
      />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => onChange(generateCodename())}
            aria-label="Generate a new name"
          >
            <RefreshCw />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Generate a new name</TooltipContent>
      </Tooltip>
    </div>
  )
}
