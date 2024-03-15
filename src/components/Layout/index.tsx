import React from 'react'

import classes from './Layout.module.css'

interface Props {
  children: React.ReactNode
}

const Layout: React.FC<Props> = ({ children }) => {
  return <div className={classes.page}>{children}</div>
}

export default Layout
