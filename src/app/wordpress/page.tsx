'use client'
import dynamic from 'next/dynamic'
const WordPressPage = dynamic(() => import('../../views/WordPressPage'), { ssr: false })
export default function Page() { return <WordPressPage /> }
