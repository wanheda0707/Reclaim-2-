import { useState } from "react"
import type { ApiUser } from "./lib/api"

export function AccountAvatar({ user, className }: {
  user: Pick<ApiUser, "photo" | "initials">
  className: string
}) {
  const [failedPhoto, setFailedPhoto] = useState<string>()
  const photo = user.photo

  return <span className={className} aria-hidden="true">
    {photo && photo !== failedPhoto
      ? <img className="size-full rounded-[inherit] object-cover" src={photo} alt="" onError={() => setFailedPhoto(photo)} />
      : user.initials}
  </span>
}
