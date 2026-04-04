'use client'
import dynamic from 'next/dynamic'
const ClientsPage = dynamic(() => import('../../views/ClientsPage'), { ssr: false })
export default function Page() { return <ClientsPage /> }
