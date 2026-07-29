"use client";

import { useEffect, useState } from "react";
import { registerMobileRuntime } from "@/lib/mobile";
import { createClient } from "@/lib/supabase/client";

export function MobileRuntime() {
  const [online, setOnline] = useState(true);

  useEffect(() => registerMobileRuntime({ supabase: createClient(), onOnlineChange: setOnline }), []);

  return online ? null : <div className="mobile-offline" role="status"><span>Çevrimdışısın</span><p>Kayıtları görüntüleyebilirsin; hesap ve AI işlemleri bağlantı gelince devam eder.</p></div>;
}
