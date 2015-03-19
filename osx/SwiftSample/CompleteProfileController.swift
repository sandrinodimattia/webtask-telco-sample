//
//  CompleteProfileController.swift
//  TelcoMobile
//
//  Created by Sandrino Di Mattia on 18/03/15.
//  Copyright (c) 2015 Auth0. All rights reserved.
//

import UIKit

class CompleteProfileController: UIViewController, UIWebViewDelegate {
    
    var url: String = ""
    var loaded: Bool = false;
    
    @IBOutlet weak var webView: UIWebView!
    @IBOutlet weak var spinner: UIActivityIndicatorView!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        self.navigationItem.title = "Complete Profile"
        self.navigationItem.setHidesBackButton(true, animated: true)
        
        spinner.hidesWhenStopped = true
        webView.delegate = self
    }
    
    override func viewWillAppear(animated: Bool) {
        let requestURL = NSURL(string: url)
        let request = NSURLRequest(URL: requestURL!)
        webView.loadRequest(request)
    }
    
    override func viewDidLayoutSubviews() {
        self.webView?.frame = self.view.bounds
    }
    
    func webViewDidStartLoad(webView: UIWebView!)
    {
        if (!loaded) {
            spinner.startAnimating()
        }
    }
    
    func webViewDidFinishLoad(webView: UIWebView!)
    {
        loaded = true
        spinner.stopAnimating()
    }
    
    func webView(webView: UIWebView!, didFailLoadWithError error: NSError!)
    {
        spinner.stopAnimating()
    }
    
    func webView(webView: UIWebView, shouldStartLoadWithRequest request: NSURLRequest, navigationType: UIWebViewNavigationType) -> Bool {
        println("Navigating to: " + request.URL.host!)
        
        if (request.URL.host == "webview.close"){
            self.performSegueWithIdentifier("updatedProfile", sender: self)
            self.dismissViewControllerAnimated(true, completion: nil)
            spinner.stopAnimating()
            return false
        }
        if (request.URL.host == "webview.cancel"){
            navigationController?.popViewControllerAnimated(true)
            self.dismissViewControllerAnimated(true, completion: nil)
            spinner.stopAnimating()
            return false
        }
        return true
    }
}
