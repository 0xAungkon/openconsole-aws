import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSessionStore } from '../store/sessionStore'

export function EndpointDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { endpointUrl, setEndpointUrl } = useSessionStore()
  const [value, setValue] = useState(endpointUrl)

  function save() {
    const next = value.trim()
    setEndpointUrl(next)
    toast.success(next ? `Endpoint set to ${next}` : 'Using the default AWS endpoint')
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="inline-block h-4 w-[3px] rounded-full bg-primary" />
            Endpoint override
          </DialogTitle>
          <DialogDescription>
            Point requests at a local Floci / LocalStack endpoint. Leave blank to use the
            default AWS endpoint for the selected region.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="flex flex-col gap-2"
        >
          <Label htmlFor="endpoint-url">Endpoint URL</Label>
          <Input
            id="endpoint-url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            list="endpoint-suggestions"
            placeholder="http://localhost:4566"
            autoFocus
          />
          <datalist id="endpoint-suggestions">
            <option value="http://localhost:4566" />
          </datalist>
          <DialogFooter className="mt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
