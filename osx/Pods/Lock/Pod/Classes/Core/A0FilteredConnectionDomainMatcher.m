//  A0FilteredConnectionDomainMatcher.m
//
// Copyright (c) 2014 Auth0 (http://auth0.com)
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

#import "A0FilteredConnectionDomainMatcher.h"

#import "A0Connection.h"
#import "A0Strategy.h"

#import <ObjectiveSugar/ObjectiveSugar.h>

@implementation A0FilteredConnectionDomainMatcher

- (instancetype)initWithStrategies:(NSArray *)strategies filter:(NSArray *)strategyNamesToFilter {
    NSArray *filtered = [strategies select:^BOOL(A0Strategy *strategy) {
        return ![strategyNamesToFilter containsObject:strategy.name];
    }];
    return [super initWithStrategies:filtered];
}

@end
